const Game = {
    state: {
        day: 1,
        balance: 1500.00,
        currentChatId: null,
        chatProgress: {},
        chatHistory: {},
        flags: {},
        scammedCount: 0,
        correctCount: 0
    },
    timer: null,

    // === 1. 初始化与预加载 ===
    start() {
        this.preloadAssets(() => {
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.init();
        });
    },

    preloadAssets(callback) {
        const images = Object.values(ASSETS);
        let loaded = 0;
        if (images.length === 0) callback();
        images.forEach(src => {
            const img = new Image();
            img.src = src;
            img.onload = img.onerror = () => {
                loaded++;
                const pct = Math.floor((loaded / images.length) * 100);
                document.getElementById('progress-text').innerText = pct + '%';
                if (loaded === images.length) setTimeout(callback, 500);
            };
        });
    },

    init() {
        document.getElementById('my-avatar').style.backgroundImage = `url(${ASSETS.me})`;
        this.refreshDayScripts();
        this.renderList();
        UI.showTransition(1, "10.1日，国庆假期第一天");
    },

    // === 2. 剧本指针管理 ===
    refreshDayScripts() {
        Object.keys(DB.contacts).forEach(id => {
            // 构建当天的剧本 Key
            // 例如：class_group 在 Day 4 会寻找 class_group_day4
            let todayScriptKey = `${id}_day${this.state.day}`;
            
            // 特殊逻辑：大顺 Day 7 回归
            if (id === 'uncle_dashun_return' && this.state.day === 7) {
                todayScriptKey = 'uncle_dashun_return_day7';
            }

            const hasNewScript = !!DB.scripts[todayScriptKey];
            let progress = this.state.chatProgress[id];

            if (hasNewScript) {
                // 只有当该联系人有新剧本时，才重置进度
                // 如果是班级群，Day 2 没有脚本，就不会重置，保留 Day 1 的状态
                if (!progress || progress.scriptKey !== todayScriptKey) {
                    this.state.chatProgress[id] = {
                        scriptKey: todayScriptKey,
                        nodeId: 'start',
                        index: 0,
                        finished: false
                    };
                }
            } else {
                // 旧剧本没聊完，进行催促
                if (progress && !progress.finished) {
                   this.injectReminder(id);
                }
            }
        });
    },

    injectReminder(id) {
        const progress = this.state.chatProgress[id];
        const script = DB.scripts[progress.scriptKey];
        if (!script) return;
        const node = script[progress.nodeId];
        
        if (node && node.options) {
            let reminderText = "（对方正在等待你的回复...）";
            this.saveMsgToHistory({
                type: 'system', text: reminderText, 
                avatar: DB.contacts[id].avatar, senderName: DB.contacts[id].name
            }, id);
        }
    },

    // === 3. 跨天逻辑 ===
    endDay() {
        if (this.state.day >= 7) return; 

        this.fastForwardAllChats();
        this.state.day++;
        this.state.currentChatId = null;
        
        this.refreshDayScripts();
        UI.closeChat();
        UI.resetChatArea();
        this.renderList();
        
        const titles = {
            2: "10.2日，国庆假期第二天",
            3: "10.3日，国庆假期第三天",
            4: "10.4日，国庆假期第四天",
            5: "10.5日，国庆假期第五天",
            6: "10.6日，国庆假期第六天",
            7: "10.7日，国庆假期第七天"
        };
        UI.showTransition(this.state.day, titles[this.state.day] || "新的一天");
    },

    fastForwardAllChats() {
        Object.keys(this.state.chatProgress).forEach(id => {
            const progress = this.state.chatProgress[id];
            if (!progress || progress.finished) return;

            const script = DB.scripts[progress.scriptKey];
            if (!script) return;

            // 如果当前进度的剧本是属于今天的，才快进。
            // 避免快进未来日期的（理论上不会发生）或已经过期的
            if (!progress.scriptKey.includes(`day${this.state.day}`)) return;

            let loopGuard = 0;
            while (!progress.finished && loopGuard < 50) {
                const node = script[progress.nodeId];
                if (!node) break;
                if (node.options) break; // 停在选项处

                if (node.sequence) {
                    for (let i = progress.index; i < node.sequence.length; i++) {
                        this.processAndSaveMsg(node.sequence[i], 'npc', id, false);
                    }
                } else if (node.text) {
                    this.processAndSaveMsg({ text: node.text }, 'npc', id, false);
                }

                if (node.next) {
                    progress.nodeId = node.next;
                    progress.index = 0;
                } else if (node.isEnd) {
                    progress.finished = true;
                } else {
                    break;
                }
                loopGuard++;
            }
            progress.finished = true; // 强制结束当天未完成对话
        });
    },

    // === 4. 渲染与交互 ===
    renderList() {
        const listEl = document.getElementById('contact-list');
        listEl.innerHTML = '';
        
        // 筛选可见联系人
        let activeContacts = Object.keys(DB.contacts).filter(id => {
            const c = DB.contacts[id];

            // 优化点：班级群始终显示 (只要当前天数 >= 它出现的初始天数)
            if (id === 'class_group') return true;

            // 大顺特殊判定
            if (id === 'uncle_dashun') {
                if (this.state.day < 5) return false; 
                if (this.state.day === 7 && this.state.flags.refused_dashun) return false;
            }
            
            // 基础判定：还没到该角色出场的时间
            if (c.day > this.state.day) return false;
            
            return true;
        });

        // 大顺回归判定
        if (this.state.day === 7 && this.state.flags.refused_dashun) {
            activeContacts.push('uncle_dashun_return');
        }

        // 构建渲染数据
        let renderData = activeContacts.map(id => {
            let contact = DB.contacts[id];
            // 特殊处理回归版信息
            if (id === 'uncle_dashun_return') {
                contact = { name: "大顺表哥", avatar: ASSETS.uncle, initMsg: "在吗？" };
            }

            let previewText = contact.initMsg || "";
            
            // 如果有历史消息，显示最后一条
            if (this.state.chatHistory[id] && this.state.chatHistory[id].length > 0) {
                const lastMsg = this.state.chatHistory[id][this.state.chatHistory[id].length - 1];
                if (lastMsg.type === 'red_packet') previewText = "[微信红包]";
                else if (lastMsg.text && lastMsg.text.includes('[图片]')) previewText = "[图片]";
                else previewText = lastMsg.text || "";
            }

            // 计算未读状态
            const progress = this.state.chatProgress[id];
            // 只有当存在进度对象，且未完成，且该进度的脚本属于 *今天* 时，才显示未读红点
            // 这样避免了第二天班级群没有新脚本时却显示红点
            const isTodayScript = progress && progress.scriptKey.endsWith(`day${this.state.day}`);
            const isUnread = progress && !progress.finished && isTodayScript;
            
            return { id, contact, previewText, isUnread };
        });

        // 排序：未读 > 已读
        renderData.sort((a, b) => (b.isUnread - a.isUnread));

        // 渲染DOM
        renderData.forEach(item => {
            const { id, contact, previewText, isUnread } = item;
            let badgeHtml = isUnread ? `<div class="badge">${id.includes('group') ? '...' : '1'}</div>` : '';
            
            const el = document.createElement('div');
            el.className = 'chat-item';
            if (this.state.currentChatId === id) el.classList.add('active');
            el.onclick = () => this.enterChat(id, el, contact.name);
            
            el.innerHTML = `
                <div class="avatar" style="background-image: url('${contact.avatar}')">${badgeHtml}</div>
                <div class="info">
                    <div class="name">${contact.name}</div>
                    <div class="preview">${previewText}</div>
                </div>
            `;
            listEl.appendChild(el);
        });
    },

    enterChat(id, elInstance, nameOverride) {
        if(this.state.currentChatId === id) return;
        this.stopScript();

        this.state.currentChatId = id;
        document.querySelectorAll('.chat-item').forEach(d => d.classList.remove('active'));
        if(elInstance) {
            elInstance.classList.add('active');
            const badge = elInstance.querySelector('.badge');
            if(badge) badge.style.display = 'none';
        }

        const chatName = nameOverride || DB.contacts[id].name;
        UI.openChat(chatName);

        // 渲染历史
        if (this.state.chatHistory[id]) {
            this.state.chatHistory[id].forEach(msg => UI.renderMsgDirectly(msg));
        }

        // 继续剧情
        const progress = this.state.chatProgress[id];
        if (!progress || progress.finished) return; // 仅浏览历史
        
        // 只有当前正在进行的剧本才继续跑
        if (progress.scriptKey.endsWith(`day${this.state.day}`)) {
            this.runScriptLoop(progress.scriptKey);
        }
    },

    // === 5. 脚本引擎 ===
    runScriptLoop(scriptKey) {
        this.stopScript();
        const id = this.state.currentChatId;
        const progress = this.state.chatProgress[id];
        if (!progress || progress.scriptKey !== scriptKey) return; 

        const script = DB.scripts[scriptKey];
        if (!script) return;
        const node = script[progress.nodeId];
        if (!node) return;

        if (node.sequence) {
            if (progress.index < node.sequence.length) {
                const msgData = node.sequence[progress.index];
                this.processAndSaveMsg(msgData, 'npc', id, true);
                
                progress.index++;
                let delay = Math.min(2500, Math.max(1000, msgData.text ? msgData.text.length * 150 : 1000));
                this.timer = setTimeout(() => this.runScriptLoop(scriptKey), delay);
            } else {
                this.timer = setTimeout(() => this.finishNode(scriptKey, node), 800);
            }
        } else if (node.text) {
             this.processAndSaveMsg({ text: node.text }, 'npc', id, true);
             this.finishNode(scriptKey, node);
        } else if (node.options) {
            UI.renderOptions(node.options, scriptKey);
        }
    },

    finishNode(scriptKey, node) {
        const id = this.state.currentChatId;
        const progress = this.state.chatProgress[id];

        if (node.next) {
            progress.nodeId = node.next;
            progress.index = 0;
            this.runScriptLoop(scriptKey);
        } else if (node.options) {
            UI.renderOptions(node.options, scriptKey);
        } else if (node.isEnd) {
            progress.finished = true;
            if(node.action) this.handleAction(node.action);
            this.renderList();
        }
    },

    handleOption(opt, scriptKey) {
        const id = this.state.currentChatId;
        const progress = this.state.chatProgress[id];

        this.processAndSaveMsg({ text: opt.text }, 'me', id, true);

        if (opt.cost) this.state.balance -= opt.cost;
        if (opt.action) this.handleAction(opt.action);
        
        UI.updateWallet(this.state.balance.toFixed(2));

        if (opt.next) {
            progress.nodeId = opt.next;
            progress.index = 0;
            const nextNode = DB.scripts[scriptKey][opt.next];
            if (nextNode && nextNode.autoMe) {
                setTimeout(() => {
                    this.processAndSaveMsg({ text: nextNode.autoMe }, 'me', id, true);
                    setTimeout(() => this.runScriptLoop(scriptKey), 500);
                }, 500);
            } else {
                this.runScriptLoop(scriptKey);
            }
        } else if (opt.isEnd) {
            progress.finished = true;
            this.renderList();
        }
    },

    processAndSaveMsg(msgData, source, targetId, renderNow) {
        const id = targetId || this.state.currentChatId;
        const contact = DB.contacts[id] || { avatar: ASSETS.app }; 
        
        let msgObj = {
            type: msgData.type || (source === 'me' ? 'me' : 'other'),
            text: msgData.text,
            avatar: source === 'me' ? ASSETS.me : contact.avatar,
            senderName: null,
            amount: msgData.amount // 红包金额
        };

        if (contact.type === 'group' && source !== 'me') {
            let senderKey = msgData.sender || 'npc1';
            if (GROUP_MEMBERS[id] && GROUP_MEMBERS[id][senderKey]) {
                msgObj.avatar = GROUP_MEMBERS[id][senderKey].avatar;
                msgObj.senderName = GROUP_MEMBERS[id][senderKey].name;
            }
        }
        this.saveMsgToHistory(msgObj, id);
        if (renderNow && id === this.state.currentChatId) {
            UI.renderMsgDirectly(msgObj);
            this.renderList(); 
        }
    },

    saveMsgToHistory(msgObj, id) {
        if (!this.state.chatHistory[id]) this.state.chatHistory[id] = [];
        this.state.chatHistory[id].push(msgObj);
    },

    handleAction(action) {
        if (action === 'flag_refuse_dashun') this.state.flags.refused_dashun = true;
        if (action === 'scammed') this.state.scammedCount++;
        if (action === 'safe') this.state.correctCount++;
        
        if (action === 'check_score') {
            const scammed = this.state.scammedCount;
            let title = "", msg = "";
            if (scammed >= 4) {
                title = "【反诈意识亟待加强】";
                msg = `7天内被骗 ${scammed} 次！\n建议重新体验，记住每个防骗要点。`;
            } else if (scammed >= 1) {
                title = "【具备基础防骗意识】";
                msg = `7天内被骗 ${scammed} 次。\n细节决定成败，下次一定能识破！`;
            } else {
                title = "【反诈先锋】";
                msg = "恭喜！7天 0 被骗！\n你拥有火眼金睛，请分享给朋友！";
            }
            setTimeout(() => alert(`${title}\n\n${msg}`), 500);
        }
    },

    stopScript() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
};

const UI = {
    dom: {
        chatStage: document.getElementById('chat-stage'),
        msgContainer: document.getElementById('msg-container'),
        optPanel: document.getElementById('options-panel'),
        chatTitle: document.getElementById('chat-title')
    },
    openChat(title) {
        this.dom.chatTitle.innerText = title;
        this.dom.msgContainer.innerHTML = ''; 
        this.dom.optPanel.innerHTML = '';
        this.dom.chatStage.classList.add('active');
    },
    closeChat() {
        Game.stopScript();
        this.dom.chatStage.classList.remove('active');
        this.dom.msgContainer.innerHTML = '';
    },
    resetChatArea() {
        Game.stopScript();
        this.dom.msgContainer.innerHTML = '<div class="empty-state pc-only"><p>请选择左侧联系人</p></div>';
        this.dom.optPanel.innerHTML = '';
        this.dom.chatTitle.innerText = '微信';
    },
    renderMsgDirectly(msg) {
        if (msg.type === 'system') { this.renderSystemMsg(msg.text); return; }
        this.appendMsg(msg.type, msg.text, msg.avatar, msg.senderName, msg.amount);
    },
    renderSystemMsg(text) {
        const div = document.createElement('div');
        div.className = 'msg-row system';
        div.innerHTML = `<div class="bubble">${text}</div>`;
        this.dom.msgContainer.appendChild(div);
        this.scrollToBottom();
    },
    appendMsg(type, text, avatar, senderName, amount) {
        const div = document.createElement('div');
        div.className = `msg-row ${type}`;
        
        let nameHTML = senderName ? `<div class="group-sender">${senderName}</div>` : '';
        let contentHTML = '';

        if (type === 'red_packet') {
            // 红包特定 HTML 结构
            contentHTML = `
                <div class="bubble">
                    <div class="rp-content">
                        <div class="rp-icon"></div>
                        <div class="rp-text">${text}</div>
                    </div>
                    <div class="rp-footer">微信红包</div>
                </div>`;
        } else {
            // 普通文本
            contentHTML = `<div class="bubble">${text}</div>`;
        }

        div.innerHTML = `
            <div class="avatar" style="background-image: url('${avatar}')"></div>
            <div class="msg-content">${nameHTML}${contentHTML}</div>
        `;
        this.dom.msgContainer.appendChild(div);
        this.scrollToBottom();
    },
    renderOptions(options, scriptKey) {
        this.dom.optPanel.innerHTML = '';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'opt-btn';
            btn.innerText = opt.text + (opt.cost ? ` (-${opt.cost})` : '');
            btn.onclick = () => {
                this.dom.optPanel.innerHTML = '';
                Game.handleOption(opt, scriptKey);
            };
            this.dom.optPanel.appendChild(btn);
        });
        this.scrollToBottom();
    },
    toggleWallet() { alert("当前余额: " + Game.state.balance.toFixed(2)); },
    updateWallet(amount) { document.getElementById('wallet-amount').innerText = amount; },
    scrollToBottom() { setTimeout(() => { this.dom.msgContainer.scrollTop = this.dom.msgContainer.scrollHeight; }, 50); },
    showTransition(day, text) {
        const el = document.getElementById('transition-layer');
        document.getElementById('trans-title').innerText = `Day ${day}`;
        document.getElementById('trans-desc').innerText = text;
        document.getElementById('day-display').innerText = day;
        el.classList.remove('hidden');
    },
    hideTransition() { document.getElementById('transition-layer').classList.add('hidden'); }
};

window.onload = () => Game.start();