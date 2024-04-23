/**
 * Events for player.
 * @typedef {Object} MusicPlayerEvents
 * @property {string} songStart - Event triggered when a song starts playing.
 * @property {string} songSkip - Event triggered when a song is skipped.
 * @property {string} songEnd - Event triggered when a song ends.
 * @property {string} songLooped - Event triggered when a song is looped.
 * @property {string} queueAdd - Event triggered when a song is added to the queue.
 * @property {string} queueEnd - Event triggered when the queue ends.
 * @property {string} queueRemove - Event triggered when a song is removed from the queue.
 * @property {string} queueClear - Event triggered when the queue is cleared.
 * @property {string} loopToggled - Event triggered when loop mode is toggled.
 * @property {string} volumeChange - Event triggered when the volume is changed.
 * @property {string} searchResult - Event triggered when a search result is obtained.
 * @property {string} paused - Event triggered when the player is paused.
 * @property {string} resumed - Event triggered when the player is resumed.
 * @property {string} leave - Event triggered when the player leaves.
 * @property {string} destroyed - Event triggered when the player is destroyed.
 * @property {string} error - Event triggered when an error occurs.
 */
module.exports = {
	songStart: "songStart",
	songSkip: "songSkip",
	songEnd: "songEnd",
	songLooped: "songLooped",
	queueAdd: "queueAdd",
	queueEnd: "queueEnd",
	queueRemove: "queueRemove",
	queueClear: "queueClear",
	loopToggled: "loopToggled",
	volumeChange: "volumeChange",
	searchResult: "searchResult",
	paused: "paused",
	unpaused: "unpaused",
	leave: "leave",
	destroyed: "destroyed",
	error: "error"
}