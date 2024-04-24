# Frost discord music package
Just another music package

Uses youtube to get audio

(*Real docs soon*)

### Installing package

```bash
npm i frost-music@latest
```

## Installing dependencies
### Other dependencies
If you want to skip reading this and just install all of them at once
(doesnt install ffmpeg)

```bash
npm i ytdl-core yt-stream @discordjs/voice @discordjs/opus sodium-native
```

### [Go to actual code](#Getting-started)

---
### ffmpeg

ffmpeg is required for this package to work

You can download ffmpeg from [here](https://ffmpeg.org/download.html)

Or if you would rather install it from npm you can run the following code

```bash
npm i ffmpeg-static
```
---
#### Youtube

- `ytdl-core` - Download audio
- `yt-stream` - Search youtube

`yt-stream` would have been used to download, but it sometimes drops the data

```bash
npm i ytdl-core yt-stream
```
---
#### Voice
This pacakge requires:
- Discord.js voice wrapper `@discordjs/voice`
- Opus encoding library `@discordjs/opus` (can be substituted for `opusscript`)
- Encryption package `sodium-native` (can be substituted for `libsodium-wrappers`)

```bash
npm i @discordjs/voice @discordjs/opus sodium-native
```

## Getting started

### Create a basic bot
```js
const {Client, GatewayIntentBits: Intents, Events} = require('discord.js');
const MusicManager = require('frost-music');

let prefix = '!';

const client = new Client({
	intents: [
		Intents.Guilds,
		Intents.GuildMessages,
		Intents.MessageContent,
		Intents.GuildVoiceStates
	]
});
```

### Create the music manager
```js
const Music = new MusicManager(client, {
	exludeBot: true, // Exlude bot accounts from member vc count
	deaf: true, // Make bot deafen
	errors: true, // Log errors
	volume: 100, // Set default volume (starts to distort over 100)
	maxVolume: 250, // Set maximum volume
	loop: false // Set default looping
});
```

### Handle music events
```js
// When song starts
Music.on(Music.Events.songStart, (data, player) => {
	player.data.channels.text.send(`Now playing: \`${data.song.title} by ${data.song.author}\``);
});

// When song is skipped
Music.on(Music.Events.songSkip, (data, player) => {
	player.data.channels.text.send(`Skipped \`${data.song.title} by ${data.song.author}\``);
});

// When song ends
Music.on(Music.Events.songEnd, (data, player) => {
	player.data.channels.text.send(`Song: \`${data.song.title} by ${data.song.author}\` has ended`);
});

// When song is added to queue
Music.on(Music.Events.queueAdd, (data, player) => {
	player.data.channels.text.send(`Added \`${data.song.title} by ${data.song.author}\` to the queue`);
});

// When song is removed from queue
Music.on(Music.Events.queueRemove, (data, player) => {
	player.data.channels.text.send(`Removed \`${data.song.title} by ${data.song.author}\` from queue`);
});

// When queue is cleared
Music.on(Music.Events.queueClear, (player) => {
	player.data.channels.text.send(`Queue cleared`);
});

// When queue is empty
Music.on(Music.Events.queueEnd, (player) => {
	player.data.channels.text.send(`Nothing left to play`);
});

// Get when loop is toggled
Music.on(Music.Events.loopToggled, (looping, player) => {
	player.data.channels.text.send(`Looping set to \`${looping}\``);
});

// Get when volume changes
Music.on(Music.Events.volumeChange, (volume, player) => {
	player.data.channels.text.send(`Volume set to \`${volume}\``);
});

// Get when player is paused
Music.on(Music.Events.paused, (player) => {
	player.data.channels.text.send(`Paused playback`);
});

// Get when player is unpaused
Music.on(Music.Events.unpaused, (player) => {
	player.data.channels.text.send(`Resumed playback`);
});

// Get when bot leaves
Music.on(Music.Events.leave, (player) => {
	player.data.channels.text.send(`Left`);
});

// When an error occours with the player
Music.on(Music.Events.error, (err, player) => {
	console.log(`Error: ${err}`);
});
```

### Handle search
This is seperate because its big and optional

```js
// Get search results (big one bc it also adds)
Music.on(Music.Events.searchResult, (results, msg, player) => {
	let list = [],
		size = results.data.length > 10? 10: results.data.length;
	for(let i = 0; i < size; i++){
		let result = results.data[i];
		list.push(`${i+1}. \`${result.title} by ${result.author}\``)
	}

	// Send results for user to see
	msg.channel.send(list.join('\n'))

	// Add collector to add song
	const collectorFilter = m => (m.author.id == msg.author.id);
	const collector = msg.channel.createMessageCollector({
		filter: collectorFilter,
		time: 15_000 // Give 15 seconds to choose
	});

	// Save if valid awnser has been given
	let recived = false;

	// Get messages
	collector.on('collect', m => {
		// Return if done, or not a number
		if(recived || !Number(m.content)) return;
		// Return if over 10 or less than 1
		if(Number(m.content) > 10 || Number(m.content) < 1) return;
		recived = true;
		
		player.addFromSearch(Number(m.content)-1, m.author.id)
	});

	// End of 15 seconds
	collector.on('end', () => {
		// See if recived
		if(recived) return;
		// Didnt get anything :(
		msg.channel.send('Didnt get a response on time')
	});
});
```

### Auto leave when alone in channel
*This is optional*
```js
// When user leaves voice
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
	if (!oldState.channel && newState.channel) return;
	if (!Music.has(oldState.guild.id)) return;

	if (Music.membercount(oldState.guild.id) < 1) {
		Music.leave(oldState.guild.id);
	}
});
```

### Handle commands
```js
client.on(Events.MessageCreate, (msg) => {
	if (!msg.content.toLowerCase().startsWith(prefix)) return;
	let args = msg.content.slice(prefix.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	// Play song
	if (command == 'play') {
		// Check if message author is in voice channel
		if (!msg.member.voice.channel) return msg.channel.send("You must be in a voice");
		// Create the player for guild if there is none
		if (!Music.has(msg.guild.id)) Music.create(msg.guild, msg.member.voice.channel, msg.channel);
		let player = Music.get(msg.guild.id);

		// Add song with who it was requested by
		player.play(args.join(' '), msg.author.id);
	}

	// Search for song
	if(command == 'search'){
		// Check if message author is in voice channel
		if (!msg.member.voice.channel) return msg.channel.send("You must be in a voice");
		// Create the player for guild if there is none
		if (!Music.has(msg.guild.id)) Music.create(msg.guild, msg.member.voice.channel, msg.channel);
		let player = Music.get(msg.guild.id);
		
		player.search(args.join(' '), msg);
	}

	// Rest require player before use
	if(Music.has(msg.guild.id)){
		let player = Music.get(msg.guild.id);
		// Skip the current song
		if(command == 'skip') player.skipSong();
		// Pause the saong
		if(command == 'pause') player.pause();
		// Resume the song
		if(command == 'unpause') player.unpause();
		// Set volume of song
		if(command == 'volume') player.setVolume(args[0])
		// Loop current song
		if(command == 'loop') player.loop();
		// Leave channel and stopp all playback
		if(command == 'leave') player.leave();
		// Clear the queue
		if(command == 'clear') player.clearQueue();
		// Remove item from queue
		if(command == 'remove') player.removeFromQueue(arg[0])
	}
});
```

### See when bot has come online
```js
client.on(Events.ClientReady, () => {
	console.log(`Logged in as ${client.user.username}!`);
});
```

### Make client login
```js
client.login('token-here')
```

-- *More platforms may come soon* --
