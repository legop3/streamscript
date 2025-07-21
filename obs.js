import { OBSWebSocket } from 'obs-websocket-js';
import sceneConfig from './sceneConfig.json' assert { type: 'json'}
import { tools } from './tools.js';

const obs = new OBSWebSocket();

await obs.connect()

// let loading = await obs.call('GetSceneItemId', {sourceName: 'loading', sceneName: 'Scene'})

// console.log(loading)

// obs.call('SetSceneItemEnabled', {sceneItemEnabled: true, sceneName: 'Scene', sceneItemId: loading.sceneItemId})



async function loadingSpinnerControl(hide) {
    try {

        let loadingSpinner = await obs.call('GetSceneItemId', {
            sourceName: sceneConfig.objects.ollamaLoadingSpinner.name,
            sceneName: sceneConfig.objects.ollamaLoadingSpinner.scene
        })

        // console.log(loadingSpinner.sceneItemId)

        obs.call('SetSceneItemEnabled', {
            sceneItemEnabled: hide,
            sceneName: sceneConfig.objects.ollamaLoadingSpinner.scene,
            sceneItemId: loadingSpinner.sceneItemId
        })

        let itemHidden = await obs.call('GetSceneItemEnabled', {
            sceneName: sceneConfig.objects.ollamaLoadingSpinner.scene,
            sceneItemId: loadingSpinner.sceneItemId
        })

        return itemHidden

    } catch(err) {
        console.log('loading spinner error: ', err)
    }

}

export {
    obs,
    loadingSpinnerControl
}