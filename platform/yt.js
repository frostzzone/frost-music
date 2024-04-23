const ytdl = require('ytdl-core')
const yts = require('yt-stream')

/**
 * YT class for handling YouTube functionality
 * @class
 */
class YT {
	constructor(){
		this.results = [];
	}

	/**
	 * Handles user input for YouTube video/audio
	 * @param {string} input - User input to handle
	 * @returns {Object} - Result object
	 */
	async handleUserInput(input){
		let query = await this.#makeURL(input);
		//if(query.type == 'url') console.log(await ytdl.getBasicInfo(query.output))
		//console.log(`Query: \n${JSON.stringify(query, null, 4)}`)
		let search = await this.search(query.output)
		return search[0];
	}

	/**
	 * Generates a URL from the input (private function)
	 * @param {string} input - Input to generate the URL from
	 * @returns {Promise<Object>} - Promise resolving to the generated URL
	 */
	async #makeURL(input){
		if(yts.validateVideoURL(input)) return { output: input, type: "url"};
		if(yts.validateID(input)) return { output: input, type: "url"}
		return {output: input, type: "string"}
	}

	/**
	 * Get the video link from the provided data (this is sent to getStream)
	 * @param {Object} data - Data containing the video information
	 * @returns {string} - Video link
	 */
	getLink(data){
		return data.url;
	}

	/**
	 * Search for videos based on the query
	 * @param {string} query - Query to search for videos
	 * @param {number} [limit=null] - Limit the number of search results
	 * @param {Player} [player=null] - Player instance to handle errors
	 * @returns {Promise<Array>} - Promise resolving to the search results
	 */
	async search(query, limit = null, player = null){
		 // Remember to clear the results :facepalm:
			this.results = []
		
			try{
				let results = await yts.search(query);
				//console.log(results)
				if (results.length == 0) return [];
				if (limit == null) limit = results.length;
				if(limit > results.length) limit = results.length;
				for (let i = 0; i < limit; i++){
						this.results.push(results[i]);
				}
				return this.results;
			} catch (err){
				if(player){
					player.emit(player.Events.error, err);
				} else console.log(err);
				return null
			}
	}

	/**
	 * Get the video stream for the given id
	 * @param {string} id - Video ID/link
	 * @param {Object} [options={ filter: 'audioonly' }] - Options for getting the video stream
	 * @returns {ReadableStream} - Readable stream for the video
	 */
	getStream(id, options = { filter: 'audioonly' }) {
		return ytdl(id, options);
	}
}

module.exports = YT