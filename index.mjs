#!/usr/bin/env node

import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {Chalk} from 'chalk';
import Table from 'cli-table';
import { pathToFileURL } from 'url';

const chalk = new Chalk({level: 2});

const minutes = 60 // size of minutes unit in seconds
const sampleTypes = {
	u16 : 'unsigned 16 bits',
	s16 : 'signed 16 bits',
	s16p : 'signed 16 bits, planar',
	flt : 'float',
	fltp : 'float, planar',
	dbl : 'double',
	dblp : 'double, planar',
}

let lastTableHeight = 0;
let clearScreen = false;

// Determine the path to the configuration file
const configDir = path.join(os.homedir(), '.radioArchive');
const configPath = path.join(configDir, '.radioArchive.config.js');

// Ensure the configuration file exists
if (!fs.existsSync(configPath)) {
    console.error(`Configuration file does not exist: ${configPath}`);
    process.exit(1);
}

let stations, radioArchiveLoc

// Load the configuration file
import(pathToFileURL(configPath)).then(config => {
	stations = config.default.stations;
	radioArchiveLoc = config.default.radioArchiveLoc;

	// Start all recordings immediately
	startAllRecordings();

	// Prepare folder for tomorrow and set an interval to check every hour
	prepareNextDayFolder(stations);
	setInterval(() => {
		prepareNextDayFolder(stations);
	}, 1*minutes*1000);

	setInterval(() => {
		updateTerminalInterface();
	}, 1000);

	// Add an interval to monitor the streams
	setInterval(() => {
		monitorStreams();
	}, 5000);  // Check every 5 seconds
    
}).catch(error => {
    console.error('Error loading configuration:', error.message);
});

// Function to update the terminal interface
function updateTerminalInterface() {
	const now = new Date()
	const height = process.stdout.rows;
	if(height!=lastTableHeight || clearScreen){
		lastTableHeight = height
		clearScreen=false;
		// Clear the entire screen
		process.stdout.write('\u001b[2J');
	}

	// Move cursor to the beginning of the screen
	process.stdout.write('\u001b[H');

	// Display additional information at the top
	console.log('======================================================');
	console.log(chalk.redBright('Stream Recorder'));
	// console.log(chalk.white('Started at: ') + chalk.green(startedAt.toString()));
	// if(restartingAt) {
		// const restartDuration = Math.ceil((restartingAt-now)/1000);
		// const restartMinutes = Math.floor(restartDuration / 60);
		// const restartSeconds = Math.floor(restartDuration % 60);
		// const restartText = chalk.green(restartMinutes+':'+restartSeconds);
		// console.log(chalk.white('Restarting at: ') + chalk.green(restartingAt.toString()));
		// console.log(chalk.white('Restarting in: ') + chalk.green(restartMinutes+':'+restartSeconds));
	// }
	// console.log('-------------------------');

	// Create a new table
	const table = new Table({
		head: ['Station', 'Status', 'Progress', 'Codec Data', 'Started At', 'Next Restart'],
		colWidths: [17, 20, 17, 30, 17, 17]
	});

	// Populate the table with station data
	stations.forEach(station => {
		const status = station?.status ?? "Starting..."
		const tableData = [
			chalk.cyanBright(station.name),
			(status==="Recording..." ? chalk.red('• ') : '') + chalk.green(status),
			chalk.green(station?.progress?.timemark ?? "N/A"),
		];
		if(station?.codecData){
			const data = station.codecData;
			// tableData.push(data.format)
			let sampleFormat = data.audio_details[3];
			sampleFormat = sampleTypes?.[sampleFormat] ?? sampleFormat;
			tableData.push(`Format: ${data.format}
Sample Rate: ${data.audio_details[1]}
Channels: ${data.audio_details[2]}
Sample Format: ${sampleFormat}
Bitrate: ${data.audio_details[4]}`);
		}else{
			tableData.push('')
		}
		if (station?.startedAt) {
			tableData.push(station.startedAt.toLocaleTimeString());
			
			let restartStatus = "N/A"
			if(station?.nextRestart) {
				restartStatus = station.nextRestart.toLocaleTimeString();
				const restartingAt = station.nextRestart
				const restartDuration = Math.ceil((restartingAt-now)/1000);
				const restartMinutes = Math.floor(restartDuration / 60);
				const restartSeconds = String(Math.floor(restartDuration % 60)).padStart(2,"0");
				const restartText = chalk.green("T-"+restartMinutes+':'+restartSeconds);
				restartStatus += "\n" + restartText;
			}
			
			tableData.push(restartStatus);
		} else {
			tableData.push("N/A");
			tableData.push("N/A");
		}
		table.push(tableData);
	});

	// Display the table
	console.log(table.toString());

	// Additional information at the bottom
	console.log('======================================================');
	console.log(chalk.yellowBright('Press Ctrl+C to exit.'));
	
	// console.log('Terminal size: ' + process.stdout.columns + 'x' + process.stdout.rows);
}

// Function to read a playlist file and extract stream url value
function extractStreamUrl(filePath) {
	if(filePath.endsWith('.pls')){
		return extractStreamUrlFromPls(filePath);
	}
	if(filePath.endsWith('.m3u')){
		return extractStreamUrlFromM3u(filePath);
	}
}

// Function to read .pls file and extract File1 value
function extractStreamUrlFromM3u(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	return content.trim()
}
// Function to read .pls file and extract File1 value
function extractStreamUrlFromPls(filePath) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const match = content.match(/^File1=(.*)$/m);
	return match ? match[1] : null;
}

// Function to record a stream
function recordStream(station, url, outputFilename) {
	return ffmpeg(url)
		.inputOptions([
			// '-user_agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"'  // Set the User-Agent
		])
		.audioCodec('copy')  // Copy the audio stream without re-encoding
		// .format('mp3')       // Output format
		.format('segment')   // Use the segment muxer
		.outputOptions([
			`-segment_time ${30*minutes}`,  // Segment duration in seconds
			'-reset_timestamps 1', // Reset timestamps at the beginning of each segment
			'-strftime 1'          // Use strftime in the output filename
		])
		.on('start', (commandLine) => {
			station.status = "Started"
			clearScreen=true;
			// console.log(`[${station.name}] Spawned Ffmpeg with command: ` + commandLine);
		})
		.on('codecData', function(data) {
			station.codecData = data;
			// station.codecData = JSON.stringify(data,null,2);
			// station.codecData = `Format: ${data.format}
// Sample Rate: ${data.audio_details[1]}
// Channels: ${data.audio_details[2]}
// Sample Format: ${data.audio_details[3]}
// Bitrate: ${data.audio_details[4]}`
			// console.log(`[${station.name}] Input is ` + JSON.stringify(data,null,2) );
			clearScreen=true;
		})
		.on('error', (err) => {
			station.status = "ERROR!"
			// console.log(`[${station.name}] An error occurred: ${err.message}`);
		})
		.on('progress', function(progress) {
			station.status = "Recording..."
			station.progress = progress;
			station.lastProgressTime = new Date();  // Update the last progress time
			updateTerminalInterface()
		})
		.on('end', () => {
			station.status = "Stopped"
			// console.log(`Recording saved to ${outputFilename}`);
		})
		.save(`${outputFilename}`);  // Save the stream to a file
}

// Function to ensure directory exists
function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function prepareNextDayFolder(stations) {
	const now = new Date()
	const year = String(now.getFullYear())
	const month = String(now.getMonth()+1).padStart(2,"0")
	const day = String(now.getDate()).padStart(2,"0");
	const dayName = now.toLocaleString('en-US', { weekday: 'long' });
	const monthName = now.toLocaleString('en-US', { month: 'long' });

	stations.forEach((station)=>{
		const tomorrowDirFancy = path.join(radioArchiveLoc,station.name,year,`${month}-${monthName}`,`${day}-${dayName}`);
		const tomorrowDir = path.join(radioArchiveLoc,station.name,year,month,day);
		ensureDir(tomorrowDirFancy);
		ensureDir(tomorrowDir);
	})
}

function startStationRecording(station,isTimelyRestart=false){
	// Extract the stream URL from the .pls file
	const streamUrl = extractStreamUrl(path.join(configDir, station.file));

	if (streamUrl) {
		// Start recording
		const outputFilename = path.join(radioArchiveLoc, station.name, `/%Y/%m/%d/${station.name}_%Y-%m-%d_%H-%M-%S.mp3`);
		station.streamRecording = recordStream(station, streamUrl, outputFilename);
		station.startedAt = new Date();  // Update the startedAt time
		if(!isTimelyRestart){
			station.nextRestart = new Date(station.startedAt.getTime() + timeUntilNextStart());  // Next restart time
			// Schedule to start all recordings again at the top of the next hour
			station.restartTimeout = setTimeout(() => {
				station.streamRecording.kill()
				startStationRecording(station, true)
			}, timeUntilNextStart());
		}else{
			station.nextRestart = null 
		}

	} else {
		console.log('Could not extract stream URL from station playlist');
	}
}

function startAllRecordings() {
	stations.forEach((station) => {
		startStationRecording(station)
	});
	clearScreen=true;
}
// Function to calculate time until the next hour in milliseconds
function getNextStart(){
	const now = new Date();
	const nextStart = new Date(now);

	
	// If current minutes are less than 30, set the next start time to the 30-minute mark of the current hour
	if (now.getMinutes() < 30) {
		nextStart.setMinutes(30);
	} else {
		// Otherwise, set the next start time to the top of the next hour
		nextStart.setHours(now.getHours() + 1);
		nextStart.setMinutes(0);
	}

	nextStart.setSeconds(0);
	nextStart.setMilliseconds(0);
	return nextStart;
}
function timeUntilNextStart(nextStart=null) {
	const now = new Date();
	if(!nextStart) nextStart = getNextStart();

	return nextStart - now;
}

// Function to monitor and restart streams if necessary
function monitorStreams() {
	stations.forEach((station) => {
		if (!station.lastProgressTime) {
			station.lastProgressTime = new Date();
		}

		const now = new Date();
		const timeSinceLastProgress = now - station.lastProgressTime;

		if ((station.status === "ERROR!" || station.status==="Recording..." || station.status==="Stopped") && timeSinceLastProgress > 10000) // 10 seconds
		{
			// Kill the existing ffmpeg process for this station
			if (station.streamRecording) {
				station.streamRecording.kill();
			}
			if (station.restartTimeout) {
				clearTimeout(station.restartTimeout)
			}
			
			station.status = 'Restarting...';
			
			
			// Restart the stream
			startStationRecording(station);
		}
	});
}
