// lrc-player - play lrc file in browser.
// Copyright (C) 2024-2025  Yu Hongbo, CNOCTAVE

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.LrcPlayer = factory());
}(this, (function () {
    'use strict';

    /**
     * LRC歌词播放器类
     * @class
     */
    class LrcPlayer {
        /**
         * 创建LrcPlayer实例
         * @static
         * @param {string} lrcText - LRC格式的歌词文本
         * @param {string} [containerId='lrc-container'] - 歌词容器的ID
         * @returns {LrcPlayer} 新的LrcPlayer实例
         */
        static init(lrcText, containerId = 'lrc-container') {
            return new LrcPlayer(lrcText, containerId);
        }

        constructor(lrcText, containerId) {
            this.lrcText = lrcText;
            this.containerId = containerId;
            this.isPlaying = false;
            this.animationFrameId = null;
            this.startTime = 0;
            this._parseLrc();
            this._createLyricsDOM();
        }

        _parseLrc() {
            // 解析LRC歌词
            this.lines = this.lrcText.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const timeMatch = line.match(/\[(\d+):(\d+)\.(\d+)\]/);
                    if (timeMatch) {
                        const minutes = parseInt(timeMatch[1]);
                        const seconds = parseInt(timeMatch[2]);
                        const milliseconds = parseInt(timeMatch[3]);
                        const time = minutes * 60 + seconds + milliseconds / 100;
                        const text = line.replace(/\[\d+:\d+\.\d+\]/, '').trim();
                        return { time, text };
                    }
                    return null;
                })
                .filter(Boolean)
                .sort((a, b) => a.time - b.time);
        }

        /**
         * 开始播放歌词
         * @throws {Error} 如果无法初始化音频上下文会抛出错误
         */
        play() {
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.startTime = performance.now();
                this._updateLyricsPosition();
            }
        }

        /**
         * 暂停播放
         */
        pause() {
            this.isPlaying = false;
            this.pausedTime = (performance.now() - this.startTime) / 1000; // 转换为秒
            cancelAnimationFrame(this.animationFrameId);
        }

        /**
         * 从暂停处继续播放
         */
        resume() {
            if (this.pausedTime !== undefined) {
                this.isPlaying = true;
                this.startTime = performance.now() - (this.pausedTime * 1000);
                this._updateLyricsPosition();
            }
        }

        _createLyricsDOM() {
            const container = document.createElement('div');
            container.id = this.containerId;
            container.style.cssText = `
                position: relative;
                min-height: 10vh;
                overflow: hidden;
                margin: 20px 0;
            `;
            
            const lyricsWrapper = document.createElement('div');
            lyricsWrapper.id = `${this.containerId}-wrapper`;
            lyricsWrapper.style.cssText = `
                position: absolute;
                width: 100%;
                transition: transform 0.1s linear;
            `;
            
            this.lines.forEach(line => {
                const lineDiv = document.createElement('div');
                lineDiv.classList.add('lrc-player-text');
                lineDiv.textContent = line.text;
                lineDiv.style.cssText = `
                    padding: 5px 0;
                    text-align: center;
                `;
                lyricsWrapper.appendChild(lineDiv);
            });
            
            container.appendChild(lyricsWrapper);
            document.body.appendChild(container);
            this.lyricsWrapper = lyricsWrapper;
        }

        _updateLyricsPosition() {
            const elapsed = (performance.now() - this.startTime) / 1000; // 转换为秒
            const currentLine = this._getCurrentLine(elapsed);
            
            if (currentLine) {
                const lineIndex = this.lines.findIndex(line => line === currentLine);
                const lineHeight = this.lyricsWrapper.children[0]?.offsetHeight || 30;
                const offset = lineIndex * lineHeight;
                
                this.lyricsWrapper.style.transform = `translateY(${-offset}px)`;
                
                // 更新所有歌词行的class
                Array.from(this.lyricsWrapper.children).forEach((div, index) => {
                    if (this.lines[index] === currentLine) {
                        div.classList.add('lrc-player-highlight');
                        div.classList.remove('lrc-player-text');
                    } else {
                        div.classList.add('lrc-player-text');
                        div.classList.remove('lrc-player-highlight');
                    }
                });
                
                if (typeof this.onLyricChange === 'function') {
                    this.onLyricChange(currentLine.text, currentLine);
                }
            }

            this.animationFrameId = requestAnimationFrame(() => this._updateLyricsPosition());
        }

        /**
         * 获取当前时间对应的歌词行
         * @private
         * @param {number} currentTime - 当前时间(秒)
         * @returns {Object|null} 当前歌词行对象，包含time和text属性
         */
        _getCurrentLine(currentTime) {
            for (let i = 0; i < this.lines.length; i++) {
                if (this.lines[i].time > currentTime) {
                    return this.lines[i - 1] || null;
                }
            }
            return this.lines[this.lines.length - 1] || null;
        }

        /**
         * 销毁播放器实例，移除所有创建的DOM元素
         */
        destroy() {
            // 停止动画
            cancelAnimationFrame(this.animationFrameId);
            
            // 移除DOM元素
            const container = document.getElementById(this.containerId);
            if (container) {
                container.remove();
            }
            
            // 重置状态
            this.isPlaying = false;
            this.animationFrameId = null;
            this.startTime = 0;
            this.lyricsWrapper = null;
        }

        /**
         * 设置当前播放时间（秒级精度）
         * @param {number} seconds - 要设置的播放时间（秒）
         */
        setTimeSecond(seconds) {
            this.startTime = performance.now() - (seconds * 1000);
            this.pausedTime = (performance.now() - this.startTime) / 1000; // 转换为秒
            if (this.isPlaying) {
                cancelAnimationFrame(this.animationFrameId);
                this._updateLyricsPosition();
            } else {
                this._updateLyricsPosition();
                cancelAnimationFrame(this.animationFrameId);
            }
        }

        /**
         * 设置当前播放时间（毫秒级精度）
         * @param {number} milliseconds - 要设置的播放时间（毫秒）
         */
        setTimeMillisecond(milliseconds) {
            this.startTime = performance.now() - milliseconds;
            this.pausedTime = (performance.now() - this.startTime) / 1000; // 转换为秒
            if (this.isPlaying) {
                cancelAnimationFrame(this.animationFrameId);
                this._updateLyricsPosition();
            } else {
                this._updateLyricsPosition();
                cancelAnimationFrame(this.animationFrameId);
            }
        }

        /**
         * 从头开始重新播放歌词
         */
        replay() {
            this.pause();
            this.play();
        }
    }

    return LrcPlayer;
})));