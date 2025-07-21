import { OBSWebSocket } from 'obs-websocket-js';
import config from './sceneConfig.json' assert { type: 'json'}
import { tools } from './tools.js';

const obs = new OBSWebSocket();

await obs.connect()

// let loading = await obs.call('GetSceneItemId', {sourceName: 'loading', sceneName: 'Scene'})

// console.log(loading)

// obs.call('SetSceneItemEnabled', {sceneItemEnabled: true, sceneName: 'Scene', sceneItemId: loading.sceneItemId})

export {
    obs
}