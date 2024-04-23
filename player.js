const {
	createAudioPlayer,
	createAudioResource,
	StreamType,
	demuxProbe,
	joinVoiceChannel,
	NoSubscriberBehavior,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	getVoiceConnection
} = require('@discordjs/voice')

const fs = require('fs');

// Local imports
const Events = require('./Events');
const Platforms = require('./Platforms');

// Music platform managers
let M = {}
	const YTclass = require('./platform/yt');
	M[Platforms.youtube] = new YTclass();

// function getSong(item){
// 	if(item.platform == 'yt') return YT.getLink(item.song);
// }

/**
 * Turn ms timestamp into a S timestamp (unix)
 * @param {number} timeMs - Timestamp in ms
 * @returns {number} - Timestamp in s (unix)
 */
function unix(timeMs = 0){
	return Math.floor(Number(timeMs)/1000);
}

/**
 * Update song timestamps
 * @param {number} timeMs - Timestamp in ms
 * @returns {number} - Timestamp in s (unix)
 */
function updateTimestamps(that){
	let now = new Date().getTime();
	that.data.song_times.start += (now - that.data.song_times.start);
	that.data.song_times.start_unix += (unix(now) - that.data.song_times.start_unix);
	that.data.song_times.end =	 now + that.data.song_times.duration;
	//console.log(that.data.song_times.end_unix)
	that.data.song_times.end_unix = unix(now + that.data.song_times.duration)
	//console.log(that.data.song_times.end_unix)
	that.data.song_times.last_timestamp_update = now;
}

/**
 * Player class representing a music player
 * @class
 */
class Player {
	#client = null;
	#tempPath = null;
	#destroyed = false;
	#skipped = false;
	#retrySong = false;

	/**
	 * Constructor for the Player classcl
	 * @param {Object} guild - The guild where the player is located
	 * @param {Object} voiceChannel - The voice channel where the player is connected
	 * @param {Object} textChannel - The text channel for the player
	 * @param {Object} client - The Discord client object
	 * @param {Object} options - Configuration options
	 */
	constructor(guild, voiceChannel, textChannel, client, options)
	{
		this.#client = client;
		
		this.events = {};
		this.queue = [];

		this.data = {
			ids: {
				guild: guild.id,
				voice: voiceChannel.id,
				text: textChannel.id
			},
			channels: {
				guild: guild,
				voice: voiceChannel,
				text: textChannel
			},
			playing: null,
			song_times: {
				start: 0,
				start_unix: 0,
				end: 0,
				end_unix: 0,
				duration: 0,
				duration_unix: 0,
				last_timestamp_update: 0
			},
			volume: Number(options.volume) || 100,
			maxVolume: Number(options.maxVolume) || 250,
			looping: options.loop || false,
			paused: false,
			search: new Map()
		};
		
		this.#tempPath = `./temp/music-manager/${guild.id}_${voiceChannel.id}.mp3`

		// Create for later use
		this.audioResource = null;

		// Create audio player
		this.player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Play
			}
		});
		
		// Create connection to vc
		this.connection = joinVoiceChannel({
			channelId: voiceChannel.id,
			guildId: guild.id,
			adapterCreator: guild.voiceAdapterCreator,
			selfDeaf: options.deaf || true
		})

		// Subscribe to the player
		this.connection.subscribe(this.player);

		// I am idle
		let that = this;
		this.player.on(AudioPlayerStatus.Idle, async () =>
		{
		// Loop
		if ((that.data.looping) && fs.existsSync(that.#tempPath) && !that.#destroyed)
		{
			that.stream = fs.createReadStream(that.#tempPath)

			that.audioResource= createAudioResource(that.stream, {
				inputType: StreamType.Arbitrary,
				inlineVolume: true
			});

			that.audioResource.volume.setVolume(that.data.volume/100);

			// Play audio through player
			that.player.play(that.audioResource);

			// Set timestamps
			let now = new Date().getTime(),
				song_length = that.data.song_times.duration || 0;
			that.data.song_times = {
					start: now,
					start_unix: unix(now),
					end: now + song_length,
					end_unix: unix(now + song_length),
					duration: song_length,
					duration_unix: unix(song_length),
					//duration_formatted: formatDuration(song_length),
					last_timestamp_update: now
				}

			that.emit(Events.songLooped, that.data.playing);
			/* Temp
				textChannel.send('Looped audio');
			//*/

			return
		}

		if (!that.#destroyed){
			if(that.queue.length == 0){
				that.data.playing = null;
				return that.emit(Events.queueEnd)
			}

			if(that.#retrySong){
				that.#retrySong = false;
				that.#play(that.data.playing)
				return
			}
			
			if(!that.#skipped){
				that.emit(Events.songEnd, that.data.playing)
			} else {
				that.emit(Events.songSkip, that.data.playing)
				that.#skipped = false
			}

			that.data.playing = that.queue.shift();
			
			return that.#play(that.data.playing)

			/* Temp
				textChannel.send('I am idle');
			//*/
		}
		})
	}

	/**
	 * Search for a song based on a query and platform
	 * @param {string} query - The search query
	 * @param {string} platform - The platform to search on (default is youtube)
	 * @param {number} [limit=null] - Limit the number of search results
	 * @returns {Promise<Object>} - Promise resolving to the search results
	 */
	async search(query, msg = null, limit = null, platform = Platforms.youtube){
		// Acutally search
		let results = {
			data: await M[platform].search(query, limit, this),
			platform: platform
		};
		
		if (results?.data == null) return null;
		
		this.data.search.set(msg?.author?.id || this.data.ids.guild, results);
		
		this.emit(Events.searchResult, results, msg)
		return results;
	}

	/**
	 * Add a song from the search results to the player's queue
	 * @param {number} index - The index of the song in the search results
	 * @param {string} [user=null] - The user who requested the song
	 */
	addFromSearch(index, userid = null){
		if(!this.data.search.has(userid) && !this.data.search.has(this.data.ids.guild)) return;
		let results = this.data.search.get(userid || this.data.ids.guild) 
		if (index > results.data.length) return
		if (index < 0) return
		let item = {
				song: results.data[index],
				platform: results.platform,
				requestedBy: userid || "Not provided"
			}

		let wasQueued = false
		if(!this.data.playing) {
			this.data.playing = item;
			this.#play(item);
		} else {
			this.queue.push(item)
			this.emit(Events.queueAdd, item)
			wasQueued = true;
		}
		
		item.wasQueued = wasQueued;
		return item
	}

	/**
	 * Pause the currently playing song
	 */
	pause() {
		if(this.data.paused) return;
		updateTimestamps(this);
		
		this.player.pause();
		this.data.paused = true;
		this.emit(Events.paused)
		return this.data.paused;
	}

	/**
	 * Unpause the currently paused song
	 */
	unpause() {
		if(!this.data.paused) return;
		updateTimestamps(this);
		
		this.player.unpause();
		this.data.paused = false;
		this.emit(Events.resumed)
		return this.data.paused;
	}

	/**
	 * Get timestamps for the current song
	 */
	getTimestamps(){
		if (this.data.paused) {
			updateTimestamps(this)
		}
		return this.data.song_times;
		
		/*return {
			start: this.data.song.start_timestamp,
			end: this.data.song.end_timestamp,
			at: this.data.song.at,
			left: this.data.song.left,
			duration: this.data.song.duration
		}*/
	}
	/**
	 * Set the volume level for the player
	 * @param {number} [volume=100] - The volume level to set (default is 100)
	 */
	setVolume(volume = 100){
		let vol = Number(volume) || 100;

		vol = Math.min(Math.max(parseInt(vol), 0), this.data.maxVolume);
		
		this.data.volume = vol;
		this.audioResource.volume.setVolume(vol/100);

		this.emit(Events.volumeChange, vol)
		return vol
	}

	/**
	 * Toggle the looping of songs
	 * @param {boolean} [state] - Force chosen looping state to be set
	 * @returns {boolean} - The current looping status
	 */
	loop(state = null){
		if(!state){this.data.looping = !this.data.looping} else this.data.looping = state;
		this.emit(Events.loopToggled, this.data.looping)
		return this.data.looping;
	}

	// Most useless function, but ok
	/**
	 * Leave the voice channel and destroy the player
	 */
	leave(){
		this.emit(Events.leave)
		this.#destroy();
	}

	#destroy()
	{
		this.#destroyed = true;
		
		if (fs.existsSync(this.#tempPath)) fs.unlinkSync(this.#tempPath);

		this.player.stop();
		
		this.connection.destroy();
		
		try{
			this.stream._destroy()
		}catch(err){
			console.log(err)
		}

		this.emit(Events.destroyed)
	}

	/**
	 * Clear the entire song queue
	 */
	clearQueue(){
		this.queue = [];
		this.emit(Events.queueClear)
	}

	/**
	 * Remove a song from the queue based on index
	 * @param {number} index - The index of the song to remove
	 * @returns {Object} - The removed song
	 */
	removeFromQueue(index){
		let song = this.queue.splice(index, 1)[0];
		this.emit(Events.queueRemove, song)

		return song
	}

	/**
	 * Skip the currently playing song
	 */
	skipSong(){
		this.#skipped = true;
		this.player.stop();
	}

	// Redownload song incase of no audio
	/**
	 * Retry playing the current song in case of errors
	 */
	retrySong(){
		this.#retrySong = true;
		this.player.stop();
	}

	/**
	 * Play a song based on input and platform
	 * @param {string} input - The song name/id to play
	 * @param {string} [user=null] - The user who requested the song
	 * @param {string} [platform="youtube"] - The platform to play the song from
	 * @returns {Object} - Information about the added song
	 */
	async play(input, user, platform = Platforms.youtube) {
		//console.log(input)
		let data = { song: await M[platform].handleUserInput(input), platform, requestedBy: user || "Not provided" };

		let wasQueued = false
		if(!this.data.playing) {
			this.data.playing = data;
			this.#play(data);
		} else {
			this.queue.push(data)
			this.emit(Events.queueAdd, data)
			wasQueued = true;
		}
		data.wasQueued = wasQueued;
		return data
	}
	
	#play(songData)
	{
		this.stream = M[songData.platform].getStream(M[songData.platform].getLink(songData.song));

		// Save for looping purposes
		this.stream.pipe(fs.createWriteStream(this.#tempPath))

		this.audioResource= createAudioResource(this.stream, {
			inputType: StreamType.Arbitrary,
			inlineVolume: true
		});

		this.audioResource.volume.setVolume(this.data.volume/100);
		
		// Play audio through player
		this.player.play(this.audioResource);

		this.emit(Events.songStart, songData);

		// Set timestamps
		let now = new Date().getTime(),
			song_length = songData.song.length || 0;
		this.data.song_times = {
				start: now,
				start_unix: unix(now),
				end: now + song_length,
				end_unix: unix(now + song_length),
				duration: song_length,
				duration_unix: unix(song_length),
				//duration_formatted: formatDuration(song_length),
				last_timestamp_update: now
			}
	}

	/* -- Super Cool Events Thing -- */
	/**
	 * Subscribe to an event
	 * @param {string} eventName - The name of the event to subscribe to
	 * @param {Function} callback - The callback function for the event
	 */
		on(eventName, callback)
		{
			if (!this.events[eventName]) this.events[eventName] = [];
			this.events[eventName].push(callback);
		}

		/**
		 * Emit an event
		 * @param {string} eventName - The name of the event to emit
		 * @param {any} args - Additional arguments for the event
		 */
		emit(eventName, ...args)
		{
			const eventCallbacks = this.events[eventName];
			if (eventCallbacks)
			{
				eventCallbacks.forEach(callback =>
				{
					callback(...args);
				});
			}
		}

	/**
	 * Unsubscribe from an event
	 * @param {string} eventName - The name of the event to unsubscribe from
	 * @param {Function} callback - The callback function to unsubscribe
	 */
		off(eventName, callback)
		{
			const eventCallbacks = this.events[eventName];
			if (eventCallbacks)
			{
				this.events[eventName] = eventCallbacks.filter(cb => cb !== callback);
			}
		}
}

module.exports = Player;