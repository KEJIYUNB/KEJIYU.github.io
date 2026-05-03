// ==UserScript==
// @name         海角社区脚本
// @name:zh-CN   海角社区全能增强脚本
// @namespace    haijiao-video-mod-ultimate
// @version      0.0.4
// @description  一键深度解析提取加密视频与高清图片，内嵌超级 HLS 播放器，支持长按 2X 倍速，自动展开贴文，无损全站资源一键下载。
// @description:zh-CN 一键深度解析提取加密视频与高清图片，内嵌超级 HLS 播放器，支持长按 2X 倍速，自动展开贴文，无损全站资源一键下载。
// @author       KEJIYU
// @license      MIT
// @match        *://*.haijiao.com/*
// @match        *://*/post/details*
// @require      https://cdn.jsdelivr.net/npm/jquery@4.0.0
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/576392/%E6%B5%B7%E8%A7%92%E7%A4%BE%E5%8C%BA%E8%84%9A%E6%9C%AC.user.js
// @updateURL https://update.greasyfork.org/scripts/576392/%E6%B5%B7%E8%A7%92%E7%A4%BE%E5%8C%BA%E8%84%9A%E6%9C%AC.meta.js
// ==/UserScript==

(function ($$1) {
  'use strict';
  
  let isPlaying = false;
  let localM3u8Url = "";
  let uiInjected = false;
  let currentPostId = "";
  let autoExpandInterval = null;
  let parsedImages = [];

  const showTgModal = (callback) => {
    const modal = document.createElement('div');
    modal.id = 'mx-tg-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);z-index:2147483647;display:flex;justify-content:center;align-items:center;';
    
    modal.innerHTML = `
        <div style="background: rgba(255, 255, 255, 0.95); padding: 30px; border-radius: 16px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.4); max-width: 85%; width: 320px; position: relative;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 20px;">🎉 温馨提示</h3>
            <p style="margin: 0 0 15px 0; color: #555; font-size: 15px; line-height: 1.5;">欢迎使用全能增强脚本！<br>加入官方电报频道获取最新更新与防失联<br><span style="color: #e91e63; font-size: 13px; font-weight: bold;">（不强制加入）</span></p>
            <a href="https://t.me/Kmodify" target="_blank" style="display: inline-block; margin-bottom: 25px; color: #0088cc; font-size: 16px; font-weight: bold; text-decoration: none; background: #e6f3fa; padding: 10px 20px; border-radius: 8px; transition: background 0.3s;">
                <i class="fab fa-telegram-plane"></i> https://t.me/Kmodify<br><span style="font-size:13px; font-weight:normal; color:#666;">(点击跳转)</span>
            </a>
            <br>
            <button id="mx-tg-confirm" style="background: linear-gradient(135deg, #0088cc, #00aaff); color: white; border: none; padding: 12px 40px; border-radius: 25px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(0,136,204,0.4); transition: transform 0.2s, box-shadow 0.2s;">确定</button>
        </div>
    `;
    document.body.appendChild(modal);

    const btn = document.getElementById('mx-tg-confirm');
    btn.onmouseover = () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 6px 20px rgba(0,136,204,0.6)';
    };
    btn.onmouseout = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(0,136,204,0.4)';
    };
    
    btn.onclick = () => {
        localStorage.setItem('kmodify_tg_shown_v1', 'true');
        document.body.removeChild(modal);
        if (callback) callback();
    };
  };

  const initHlsPlayer = () => {
    if (document.getElementById("hls-player-container")) return;
    
    const hlsScript = document.createElement("script");
    hlsScript.src = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js";
    document.head.appendChild(hlsScript);
    
    const playerContainer = document.createElement("div");
    playerContainer.id = "hls-player-container";
    playerContainer.style.cssText = "position:fixed;top:0;bottom:0;left:0;right:0;background:rgba(0,0,0,0.95);padding:10px;z-index:9999996;display:none;justify-content:center;align-items:center;";
    
    const closeButton = document.createElement("button");
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.style.cssText = "position:absolute;top:20px;right:20px;background:rgba(255,255,255,0.2);color:white;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;z-index:9999999;display:flex;align-items:center;justify-content:center;";
    
    const speedIndicator = document.createElement("div");
    speedIndicator.style.cssText = "position:absolute;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:white;padding:6px 18px;border-radius:20px;font-size:14px;font-weight:bold;letter-spacing:1px;display:none;z-index:9999999;pointer-events:none;";
    speedIndicator.innerText = "▶▶ 2X 倍速播放中";
    playerContainer.appendChild(speedIndicator);

    closeButton.onclick = () => {
      playerContainer.style.display = "none";
      if(window.hlsInstance) window.hlsInstance.destroy();
      const vid = document.getElementById("hls-video");
      if(vid) vid.pause();
      isPlaying = false;
    };
    playerContainer.appendChild(closeButton);
    
    const video = document.createElement("video");
    video.id = "hls-video";
    video.style.cssText = "width:90%;height:90%;object-fit:contain;outline:none;";
    video.controls = true;
    playerContainer.appendChild(video);
    document.body.appendChild(playerContainer);

    let speedTimer;
    const startSpeedUp = (e) => {
        speedTimer = setTimeout(() => {
            video.playbackRate = 2.0;
            speedIndicator.style.display = "block";
        }, 500);
    };

    const stopSpeedUp = (e) => {
        clearTimeout(speedTimer);
        if (video.playbackRate === 2.0) {
            video.playbackRate = 1.0;
            speedIndicator.style.display = "none";
        }
    };

    video.addEventListener("mousedown", startSpeedUp);
    video.addEventListener("touchstart", startSpeedUp);
    video.addEventListener("mouseup", stopSpeedUp);
    video.addEventListener("mouseleave", stopSpeedUp);
    video.addEventListener("touchend", stopSpeedUp);
    
    window.playLocalVideo = (url) => {
        playerContainer.style.display = "flex";
        if (typeof Hls !== "undefined" && Hls.isSupported()) {
            if(window.hlsInstance) window.hlsInstance.destroy();
            const hls = new Hls();
            window.hlsInstance = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
                isPlaying = true;
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.play();
            isPlaying = true;
        }
    };
  };

  const initUI = () => {
    if (uiInjected) return;
    uiInjected = true;

    const fontAwesome = document.createElement("link");
    fontAwesome.rel = "stylesheet";
    fontAwesome.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css";
    document.head.appendChild(fontAwesome);

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes rainbowGlass {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
      }
      #mx-left-show { position: fixed; left: 20px; top: 50%; transform: translateY(-50%); z-index: 2147483640; transition: all 0.3s ease; cursor: pointer; padding: 10px; display: none; opacity: 0;}
      #mx-left-show i { color: #e91e63 !important; text-shadow: #e91e63 2px 2px 12px; font-size: 28px; }
      
      #mx-vip-box { position: fixed; top: 50%; transform: translate(0, -50%); right: 10px; width: 46px; border-radius: 30px; box-shadow: 0 8px 32px 0 rgba(0,0,0,0.2); z-index: 2147483640; transition: all 0.3s ease; display: flex; flex-direction: column; align-items: center; padding: 15px 0; gap: 22px; opacity: 1; border: 1px solid rgba(255, 255, 255, 0.4); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); background: linear-gradient(135deg, rgba(255, 182, 193, 0.4), rgba(173, 216, 230, 0.4), rgba(221, 160, 221, 0.4), rgba(255, 218, 185, 0.4), rgba(152, 251, 152, 0.4)); background-size: 300% 300%; animation: rainbowGlass 8s ease infinite;}
      
      .mx-item { position: relative; width: 100%; display: flex; justify-content: center; align-items: center; cursor: pointer; }
      .mx-item i { color: white !important; font-size: 20px; text-shadow: 2px 2px 10px rgba(255,255,255,0.8); transition: transform 0.2s;}
      .mx-item:hover i { transform: scale(1.15); }
      
      .mx-avatar img { width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.6); }
      
      .mx-tips-yuan::after { content: ''; position: absolute; top: -2px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background-color: #5ef464; box-shadow: 0 0 5px #5ef464;}
    `;
    document.head.appendChild(style);

    const leftShow = document.createElement('div');
    leftShow.id = "mx-left-show";
    leftShow.innerHTML = '<i class="fas fa-eye"></i>';
    document.body.appendChild(leftShow);

    const vipBox = document.createElement('div');
    vipBox.id = "mx-vip-box";
    vipBox.innerHTML = `
      <div class="mx-item mx-avatar"><img src="https://ui-avatars.com/api/?name=K&background=1085ba&color=fff&rounded=true" /></div>
      <div class="mx-item mx-tips-yuan" id="mx-play-btn"><i class="far fa-play-circle" style="font-size:24px;"></i></div>
      <div class="mx-item mx-tips-yuan" id="mx-download-btn"><i class="fas fa-cloud-download-alt"></i></div>
      <div class="mx-item" id="mx-hide-btn"><i class="fas fa-eye-slash" style="font-size:18px;"></i></div>
    `;
    document.body.appendChild(vipBox);

    document.getElementById('mx-hide-btn').onclick = () => {
        vipBox.style.transform = "translate(150%, -50%)";
        vipBox.style.opacity = "0";
        setTimeout(() => {
            leftShow.style.display = "block";
            setTimeout(() => { leftShow.style.opacity = "1"; leftShow.style.transform = "translateY(-50%)"; }, 50);
        }, 300);
    };

    leftShow.onclick = () => {
         leftShow.style.transform = "translate(-100px, -50%)";
         leftShow.style.opacity = "0";
         setTimeout(() => {
             leftShow.style.display = "none";
             vipBox.style.transform = "translate(0, -50%)";
             vipBox.style.opacity = "1";
         }, 300);
    };

    document.getElementById('mx-download-btn').onclick = () => {
        if (parsedImages.length === 0 && !localM3u8Url) {
            alert("未检测到可下载的资源，请先点击播放按钮进行解析。");
            return;
        }
        
        if (parsedImages.length > 0) {
            parsedImages.forEach((url, index) => {
                fetch(url).then(res => res.blob()).then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = `image_${index + 1}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }).catch(e => console.error(e));
            });
        }

        if (localM3u8Url) {
            const a = document.createElement('a');
            a.href = localM3u8Url;
            a.download = `video_${currentPostId}.m3u8`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    document.getElementById('mx-play-btn').onclick = (e) => {
        e.preventDefault();
        if (!localStorage.getItem('kmodify_tg_shown_v1')) {
            showTgModal(() => {
                triggerCrackAndPlay();
            });
        } else {
            triggerCrackAndPlay();
        }
    };
  };

  const triggerCrackAndPlay = async () => {
    if (localM3u8Url) {
        window.playLocalVideo(localM3u8Url);
        return;
    }

    const playBtnIcon = document.querySelector("#mx-play-btn i");
    if (playBtnIcon) playBtnIcon.className = "fas fa-spinner fa-spin";

    try {
        const postDetail = await fetch(`/api/topic/${getPostId()}`).then(r => r.json());
        const decodeData = decodeStrJson(postDetail.data);
        const attachments = decodeData?.attachments;

        if (attachments) {
            const images = [], videos = [], audios = [];
            attachments.forEach((element) => {
                if (element.category === "images" && !String(decodeData?.content).includes(String(element.id))) {
                    images.push(element);
                } else if (element.category === "audio") {
                    audios.push(element);
                } else if (element.category === "video") {
                    videos.push(element);
                }
            });

            handleEmptySellerContainer();
            audiosSuccess(audios);
            imagesSuccess(images);

            if (videos.length === 0) {
                 let found = false;
                 for (const video of (window.tempAttachmentArr || [])) {
                     if (video.category === "video" && video.remoteUrl) {
                         localM3u8Url = video.remoteUrl;
                         window.playLocalVideo(localM3u8Url);
                         found = true;
                         break;
                     }
                 }
                 if(!found) alert("未在此页面检测到加密视频！");
            } else {
                for (const video of videos) {
                    if (video?.remoteUrl && video?.video_time_length) {
                        const newContent = await getCodeFromString(video.video_time_length, video.remoteUrl);
                        if (newContent) {
                            const blob = new Blob([newContent], { type: "application/x-mpegURL" });
                            localM3u8Url = URL.createObjectURL(blob);
                            window.playLocalVideo(localM3u8Url);
                            break;
                        }
                    }
                }
            }
        }
    } catch (e) {
        alert("解析失败，请检查网络或刷新重试。");
    } finally {
        if (playBtnIcon) playBtnIcon.className = "far fa-play-circle";
    }
  };

  function getSellerContainer() {
    return document.querySelector("span.sell-btn") || document.querySelector("div.pagecontainer") || document.querySelector("div.publicContainer");
  }

  const handleEmptySellerContainer = () => {
    const element = getSellerContainer();
    if (element) $$1(element).html("");
  };

  const handleExpandAll = () => {
    if (autoExpandInterval) clearInterval(autoExpandInterval);
    let count = 0;
    autoExpandInterval = setInterval(() => {
      count++;
      const element = $$1('button:contains("点击展开完整贴文")');
      if (element.length > 0) {
        element.first().click();
        clearInterval(autoExpandInterval);
      } else if (count > 20) {
        clearInterval(autoExpandInterval);
      }
    }, 500);
  };

  const audiosSuccess = (audios) => {
    const sellContainer = getSellerContainer();
    if (!sellContainer || !audios.length) return;
    audios.forEach((audio) => {
      $$1(sellContainer).append($$1(`<audio src="${audio.remoteUrl}" controls="controls" style="margin:auto;display:block;"></audio>`));
    });
  };

  const CUSTOM_ALPHABET = "ABCD*EFGHIJKLMNOPQRSTUVWX#YZabcdefghijklmnopqrstuvwxyz1234567890";
  const STANDARD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function toStandard(encoded) {
    return encoded.replace(/./g, (ch) => {
      const idx = CUSTOM_ALPHABET.indexOf(ch);
      return idx === -1 ? ch : STANDARD_ALPHABET[idx];
    });
  }

  function decode(input) {
    const standard = toStandard(input);
    const utf8 = atob(standard);
    const percent = utf8.split("").map((ch) => "%" + ch.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    return decodeURIComponent(percent);
  }

  const imagesSuccess = (images) => {
    const sellContainer = getSellerContainer();
    if (!sellContainer || !images.length) return;
    images.forEach(async (img) => {
      const text = await fetch(img.remoteUrl).then((r) => r.text());
      const imgSrc = decode(text);
      parsedImages.push(imgSrc);
      $$1(sellContainer).append(`<img src="${imgSrc}" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />`);
    });
  };

  const originOpen = XMLHttpRequest.prototype.open;
  function injectHttp(videoCb) {
    XMLHttpRequest.prototype.open = function(method, url, async, username, password) {
      if (String(url).includes("/api/attachment")) {
        this.addEventListener("readystatechange", () => {
          if (this.readyState === 4) {
            videoCb(this.responseText);
            XMLHttpRequest.prototype.open = originOpen;
          }
        });
      }
      originOpen.call(this, method, url, async ?? true, username, password);
    };
  }

  const getPostId = () => {
    const match = window.location.href.match(/pid=(\d+)/);
    return match?.[1];
  };

  async function checkLinkAccess(url) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      return res.status !== 404;
    } catch (e) { return false; }
  }

  async function getLastSuccessLink(prefixUrl, video_time_length) {
    let left = 0, right = video_time_length * 2 - 1, lastAccessibleIndex = -1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const isSuccess = await checkLinkAccess(prefixUrl.replace("0.ts", `${mid}.ts`).split("?")[0]);
      if (isSuccess) { lastAccessibleIndex = mid; left = mid + 1; } 
      else { right = mid - 1; }
    }
    return lastAccessibleIndex;
  }

  function replaceKeyUri(m3u8Content, baseUrl) {
    return m3u8Content.replace(/URI="(enc_[^"]+\.key)"/g, (_, key) => `URI="${baseUrl}${key}"`);
  }

  async function getCodeFromString(length, url) {
    const text = await fetch(url).then((res) => res.text());
    const firstSegmentLine = text.split("\n").map(l => l.trim()).find(l => l && !l.startsWith("#"));
    if (!firstSegmentLine) return "";
    
    const firstSegmentHref = new URL(firstSegmentLine, url).href.split("?")[0];
    const lastSlash = firstSegmentHref.lastIndexOf("/");
    const pathPrefix = lastSlash >= 0 ? firstSegmentHref.slice(0, lastSlash + 1) : "";
    
    const count = await getLastSuccessLink(firstSegmentHref, length * 2);
    if (count < 0) return "";
    
    const avg = Number(length / count).toFixed(6);
    let realContent = "";
    for (let i = 0; i <= count; i++) {
      realContent += `#EXTINF:${avg},\n${firstSegmentHref.replace("0.ts", `${i}.ts`).split("?")[0]}\n`;
    }
    
    return replaceKeyUri(text.split("#EXTINF")[0], pathPrefix) + realContent + `#EXT-X-ENDLIST`;
  }

  const decodeStrJson = (str) => {
    try { return JSON.parse(atob(atob(atob(str)))); } catch (error) { return str; }
  };

  injectHttp((res) => {
    if (!window?.tempAttachmentArr) window.tempAttachmentArr = [];
    try {
      window.tempAttachmentArr.push(decodeStrJson(JSON.parse(res)?.data));
    } catch (error) {}
  });

  const checkUrlAndInit = () => {
    const pid = getPostId();
    if (pid && pid !== currentPostId) {
        currentPostId = pid;
        localM3u8Url = "";
        parsedImages = [];
        const playBtnIcon = document.querySelector("#mx-play-btn i");
        if (playBtnIcon) playBtnIcon.className = "far fa-play-circle";
        
        initHlsPlayer();
        initUI();
        handleExpandAll();
    }
  };

  const _pushState = history.pushState;
  history.pushState = function() {
      _pushState.apply(this, arguments);
      setTimeout(checkUrlAndInit, 500);
  };
  const _replaceState = history.replaceState;
  history.replaceState = function() {
      _replaceState.apply(this, arguments);
      setTimeout(checkUrlAndInit, 500);
  };
  window.addEventListener("popstate", () => setTimeout(checkUrlAndInit, 500));

  $$1(() => {
      setTimeout(checkUrlAndInit, 500);
  });

})(jQuery);
