
# Internet Radio Archivist

Internet Radio Archivist is a Node.js application for archiving live internet radio stations. The application records audio streams from specified radio stations and segments the recordings into half-hour chunks, saving them to disk. It is designed to be run continuously, ensuring you have a historical archive of your favorite internet radio stations.

When first starting each station will plan to restart the recording at the next half or top of the hour to ensure segments always start and end at a standard half hour interval.

## Inspiration
I love my local public radio stations and often want to find out what song is playing. Problem is I'm usually driving, or the identification app fails to match, or it matches the wrong song/artist because maybe it's a sample. For years I would try to mark the date/time so I could look it up but the stations only provide a limited archive. So now when I want to look a song up I can snap a photo of my car dashboard so I know the station then simply reference the date/time in the photo metadata and look into my own archive.

## Installation

To install Internet Radio Archivist, clone the repo, then install globally by navigating to the project directory and running the following command:
```npm install -g```

This will install the application globally on your system, allowing you to run it from anywhere.

## Configuration

Before running the application, you need to create a configuration file to specify the radio stations you want to record. The configuration file should be named `.radioArchive.config.js` and placed in a directory named `.radioArchive` in your home directory (user directory).  Mine is stored at `C:/Users/me/.radioArchive/.radioArchive.config.js`

Here's an example configuration file:
```
module.exports = {
    "stations": [
		// URLs of the audio streams (.m3u or .pls)
		{name:'89.3-WRTC', file:'wrtc.m3u'},
    ],
    "radioArchiveLoc": "C:/Users/me/Music/radioArchive",
}
```

- `stations`: An array of objects, each representing a radio station. Each object should have a `file` property specifying the path to the `.m3u` or `.pls` file for the station (relative to the config file), and a `name` property specifying the name of the station.
- `radioArchiveLoc`: The directory where recorded audio segments will be saved.

## Usage

With the configuration file in place, you can start recording radio stations by running the following command:

```radio-archive```

Or alternatively:

```archive-radio```

Once the application is running, it will continuously record the specified radio stations, saving the audio segments to the specified directory.

## Terminal Interface

The application provides a terminal interface showing the status of each recording, including the progress of the current segment, the codec information, and the time at which the recording started. The interface is updated in real time as the recordings progress.

## Troubleshooting

If you encounter any issues while running the application, check the terminal output for error messages. The application will attempt to restart any recordings that encounter errors automatically.

## License

This project is licensed under the MIT license. Please see the `LICENSE` file for more information.

## Author

Matthew Seremet (@frostbitten)