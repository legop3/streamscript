import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class TextToSpeech {
  constructor(options = {}) {
    this.voice = options.voice || 'kal16'; // default voice
    this.speed = options.speed || 1.0;
    this.volume = options.volume || 1.0;
    this.flitePath = options.flitePath || 'flite'; // assumes flite is in PATH
  }

  /**
   * Speak text directly (no file output)
   * @param {string} text - Text to speak
   * @param {Object} options - Optional parameters
   * @returns {Promise} - Resolves when speech completes
   */
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!text || typeof text !== 'string') {
        reject(new Error('Text must be a non-empty string'));
        return;
      }

      const voice = options.voice || this.voice;
      const args = ['-voice', voice, '-t', text];
      
      const flite = spawn(this.flitePath, args);
      
      flite.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`flite process exited with code ${code}`));
        }
      });

      flite.on('error', (err) => {
        reject(new Error(`Failed to start flite: ${err.message}`));
      });
    });
  }

  /**
   * Convert text to speech and save as WAV file
   * @param {string} text - Text to convert
   * @param {string} outputPath - Path for output WAV file
   * @param {Object} options - Optional parameters
   * @returns {Promise} - Resolves when file is created
   */
  textToFile(text, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      if (!text || typeof text !== 'string') {
        reject(new Error('Text must be a non-empty string'));
        return;
      }

      if (!outputPath) {
        reject(new Error('Output path is required'));
        return;
      }

      const voice = options.voice || this.voice;
      const args = ['-voice', voice, '-t', text, '-o', outputPath];
      
      const flite = spawn(this.flitePath, args);
      
      flite.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`flite process exited with code ${code}`));
        }
      });

      flite.on('error', (err) => {
        reject(new Error(`Failed to start flite: ${err.message}`));
      });
    });
  }

  /**
   * Get list of available voices
   * @returns {Promise<Array>} - Array of available voice names
   */
  getVoices() {
    return new Promise((resolve, reject) => {
      const flite = spawn(this.flitePath, ['-lv']);
      let output = '';
      
      flite.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      flite.on('close', (code) => {
        if (code === 0) {
          // Parse voice list from output
          const voices = output
            .split('\n')
            .filter(line => line.trim() && !line.includes('Available voices:'))
            .map(line => line.trim().split(/\s+/)[0])
            .filter(voice => voice);
          resolve(voices);
        } else {
          reject(new Error(`Failed to get voice list: exit code ${code}`));
        }
      });

      flite.on('error', (err) => {
        reject(new Error(`Failed to start flite: ${err.message}`));
      });
    });
  }

  /**
   * Check if flite is available
   * @returns {Promise<boolean>} - True if flite is available
   */
  checkFlite() {
    return new Promise((resolve) => {
      const flite = spawn(this.flitePath, ['--help']);
      
      flite.on('close', (code) => {
        resolve(code === 0);
      });

      flite.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Speak text from a file
   * @param {string} filePath - Path to text file
   * @param {Object} options - Optional parameters
   * @returns {Promise} - Resolves when speech completes
   */
  speakFile(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        reject(new Error(`File not found: ${filePath}`));
        return;
      }

      const voice = options.voice || this.voice;
      const args = ['-voice', voice, '-f', filePath];
      
      const flite = spawn(this.flitePath, args);
      
      flite.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`flite process exited with code ${code}`));
        }
      });

      flite.on('error', (err) => {
        reject(new Error(`Failed to start flite: ${err.message}`));
      });
    });
  }
}

export default TextToSpeech;