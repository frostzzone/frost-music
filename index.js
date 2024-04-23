/**
 * Get required packages for this file
 * @ignore
 */
const fs = require('fs');
const Events = require('./Events');
const Platforms = require('./Platforms');

const Player = require('./player.js');

//Set default configuration

/**
 * Default configuration for the MusicManager class.
 * @typedef {Object} MusicManagerConfig
 * @property {boolean} exludeBot - Exclude bot accounts from member voice channel count.
 * @property {boolean} deaf - Set bot to be deafened in voice channel.
 * @property {boolean} errors - Log errors if true.
 * @property {number} volume - Default volume level.
 * @property {number} maxVolume - Maximum volume level. (null for no limit)
 * @property {boolean} loop - Enable/disable looping.
 */
const defaultConfig = {
	exludeBot: true,
	deaf: true,
	errors: true,
	volume: 100,
	maxVolume: 250,
	loop: false
};

/**
 * Delete files in a specified directory path.
 * @ignore
 */
function deleteFilesInDirectory(directoryPath) {
	fs.readdirSync(directoryPath).forEach(file => {
		const filePath = `${directoryPath}/${file}`;
		if (fs.statSync(filePath).isFile()) fs.unlinkSync(filePath);
	});
}

// Make files
if (!fs.existsSync(`./temp/`)) fs.mkdirSync(`./temp`);
if (!fs.existsSync(`./temp/music-manager`)){
	fs.mkdirSync(`./temp/music-manager`);
} else {
	deleteFilesInDirectory(`./temp/music-manager`);
}

// Set events for player
	/**
	 * Set events for the player.
	 * @param {Player} player The player for which events are set.
	 * @param {MusicManager} that The MusicManager instance.
	 * @ignore
	 */
function setEvents(p, that){
	p.on(Events.songStart, (song) => that.emit(Events.songStart, song, p) );
	p.on(Events.songSkip, (song) => that.emit(Events.songSkip, song, p) );
	p.on(Events.songEnd, (song) => that.emit(Events.songEnd, song, p) );
	p.on(Events.queueAdd, (song) => that.emit(Events.queueAdd, song, p) );
	p.on(Events.queueRemove, (song) => that.emit(Events.queueRemove, song, p) )
	p.on(Events.queueClear, () => that.emit(Events.queueClear, (p)) )
	p.on(Events.queueEnd, () => that.emit(Events.queueEnd, p) );
	p.on(Events.loopToggled, (loop) => that.emit(Events.loopToggled, loop, p) );
	p.on(Events.volumeChange, (volume) => that.emit(Events.volumeChange, volume, p) );
	p.on(Events.searchResult, (results, msg) => that.emit(Events.searchResult, results, msg, p) )
	p.on(Events.paused, () => that.emit(Events.paused, p) )
	p.on(Events.resumed, () => that.emit(Events.resumed, p) )
	p.on(Events.leave, ()=> that.emit(Events.leave))
	p.on(Events.destroyed, () => that.emit(Events.destroyed) )
	p.on(Events.error, (err) => {
		if(that.options.errors) console.log(err);
		that.emit(Events.error, err, p)
	})
}

/**
 * MusicManager class responsible for managing music players.
 * @class
 */
class MusicManager {
	// Create private variables
	#client = null;
	#events = {};

	Events = Events;
	Platforms = Platforms;

	/**
	 * Constructor for the MusicManager class.
	 * @param {Client} client - The Discord client object.
	 * @param {MusicManagerConfig} [options=defaultConfig] - Configuration options.
	 */
	constructor(client, options = defaultConfig) {
		this.#client = client;
		this.options = options;
		
		this.players = new Map();
	};

	/**
	 * Create a new player and set events for it.
	 * @param {Guild} guild - The guild where the player is located.
	 * @param {VoiceChannel} voiceChannel - The voice channel where the player is connected.
	 * @param {TextChannel} textChannel - The text channel for the player.
	 * @returns {Player | null} - The created player or null if already exists.
	 */
	create(guild, voiceChannel, textChannel) {
		if (this.players.has(guild.id)) return null;
		if (fs.existsSync(`./temp/${guild.id}.mp3`)) fs.unlinkSync(`./temp/${guild.id}.mp3`);
		
		let p = new Player(guild, voiceChannel, textChannel, this.#client, this.options);
		this.players.set(guild.id, p);
		
		setEvents(p, this);
		
		return p;
	}

	/**
	 * Destroy a player and remove it from the manager.
	 * @param {string} guildId - The ID of the guild where the player is located.
	 * @returns {boolean} - True if player was successfully destroyed, false otherwise.
	 */
	leave(guildId) {
		if (!this.players.has(guildId)) return false;
		this.players.get(guildId).leave();
		this.players.delete(guildId)
		return true;
	}

	/**
	 * Get a player by guild ID.
	 * @param {string} guildId - The ID of the guild.
	 * @returns {Player | undefined} - The player if found, undefined otherwise.
	 */
	get(guildId){
		return this.players.get(guildId);
	}

	/**
	 * Check if a player exists for a guild.
	 * @param {string} guildId - The ID of the guild.
	 * @returns {boolean} - True if player exists, false otherwise.
	 */
	has(guildId){
		return this.players.has(guildId);
	}

	/**
	 * Get the number of members in the voice channel associated with a player.
	 * @param {string} guildId - The ID of the guild.
	 * @returns {number} - The number of members in the voice channel.
	 */
	membercount(guildId){
		try{
			if (!this.players.has(guildId)) return 0;
			
			const voiceChannel = this.players.get(guildId).channels.voice
			
			let members = voiceChannel.members;
			if(exludeBot) members = members.filter(member => !member.user.bot);
			return members.size;
			
		} catch (err) {
			if (this.options.errors) console.log(`Error in membercount: ${err}\nTo turn off errors set the "errors" option to false in the config.`);
			return 0;
		}
	}

	/* -- Super Cool Events Thing -- */
	/**
	 * Subscribe to an event in the MusicManager.
	 * @param {string} eventName - The name of the event to subscribe to.
	 * @param {Function} callback - The callback function for the event.
	 */
		on(eventName, callback)
		{
			if (!this.#events[eventName]) this.#events[eventName] = [];
			this.#events[eventName].push(callback);
		}

	/**
	 * Emit an event in the MusicManager.
	 * @param {string} eventName - The name of the event to emit.
	 * @param {any} args - Additional arguments for the event.
	 */
		emit(eventName, ...args)
		{
			const eventCallbacks = this.#events[eventName];
			if (eventCallbacks)
			{
				eventCallbacks.forEach(callback =>
				{
					callback(...args);
				});
			}
		}

	/**
	 * Unsubscribe from an event in the MusicManager.
	 * @param {string} eventName - The name of the event to unsubscribe from.
	 * @param {Function} callback - The callback function to unsubscribe.
	 */
		off(eventName, callback)
		{
			const eventCallbacks = this.#events[eventName];
			if (eventCallbacks)
			{
				this.#events[eventName] = eventCallbacks.filter(cb => cb !== callback);
			}
		}
}

// Export the MusicManager class
module.exports = MusicManager;