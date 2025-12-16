// ===== 应用配置 =====
const CONFIG = {
    experiments: {
        mathematics: [
            { id: 'function-graph', title: '函数图像', description: '可视化各种数学函数', icon: 'function', color: 'blue-gradient' },
            { id: 'calculus', title: '微积分', description: '理解导数、积分和极限', icon: 'trending-up', color: 'blue-gradient' },
            { id: 'geometry', title: '几何变换', description: '探索平移、旋转、缩放', icon: 'shapes', color: 'blue-gradient' },
            { id: 'complex', title: '复数运算', description: '复平面上的运算', icon: 'calculator', color: 'blue-gradient' }
        ],
        physics: [
            { id: 'mechanics', title: '力学模拟', description: '重力、碰撞、弹簧', icon: 'gauge', color: 'purple-gradient' },
            { id: 'electromagnetism', title: '电磁场', description: '电场和磁场分布', icon: 'zap', color: 'purple-gradient' },
            { id: 'waves', title: '波动演示', description: '声波、光波', icon: 'waves', color: 'purple-gradient' },
            { id: 'relativity', title: '相对论', description: '时间膨胀、长度收缩', icon: 'orbit', color: 'purple-gradient' }
        ],
        chemistry: [
            { id: 'periodic-table', title: '元素周期表', description: '交互式元素周期表', icon: 'table', color: 'green-gradient' },
            { id: 'molecular-structure', title: '分子结构', description: '3D可视化分子', icon: 'atom', color: 'green-gradient' },
            { id: 'reactions', title: '化学反应', description: '模拟原子重排', icon: 'test-tube', color: 'green-gradient' },
            { id: 'experiments', title: '虚拟实验', description: '安全环境化学实验', icon: 'beaker', color: 'green-gradient' }
        ],
        algorithms: [
            { id: 'sorting', title: '排序算法', description: '冒泡、快排、归并', icon: 'arrow-up-down', color: 'orange-gradient' },
            { id: 'searching', title: '搜索算法', description: '二分查找、DFS/BFS', icon: 'search', color: 'orange-gradient' },
            { id: 'graph', title: '图算法', description: '最短路径、生成树', icon: 'network', color: 'orange-gradient' },
            { id: 'data-structures', title: '数据结构', description: '栈、队列、树', icon: 'layers', color: 'orange-gradient' }
        ]
    }
};

// ===== 卫星动画系统 (修复遮挡逻辑) =====
const SatelliteSystem = {
    isRunning: true,
    startTime: Date.now(),
    satellites: [],
    orbit: null,
    
    // 对应 CSS 中的 .orbit-1 尺寸
    config: {
        radiusX: 400,
        radiusY: 250,
        perspective: 1200
    },

    init: function() {
        this.satellites = document.querySelectorAll('.satellite');
        this.orbit = document.getElementById('satellites-orbit');
        
        if (!this.orbit || this.satellites.length === 0) return;

        console.log("卫星系统启动...");
        this.startTime = Date.now();
        this.isRunning = true;
        this.loop();
        this.setupHoverEffects();
    },

    loop: function() {
        requestAnimationFrame(this.loop.bind(this));

        if (!this.isRunning) return;

        const now = Date.now();
        const elapsed = (now - this.startTime) % 20000; // 20秒一圈
        const globalAngle = (elapsed / 20000) * 360;
        
        const toRad = Math.PI / 180;
        // 对应 CSS: rotateX(65deg) rotateZ(25deg)
        const cos65 = Math.cos(65 * toRad);
        const sin65 = Math.sin(65 * toRad);
        const cos25 = Math.cos(25 * toRad);
        const sin25 = Math.sin(25 * toRad);

        this.satellites.forEach((sat, index) => {
            if (sat.classList.contains('focusing')) return;

            // 1. 2D 椭圆轨道计算
            const offsetAngle = index * 90;
            const theta = (globalAngle + offsetAngle) * toRad;
            const x_orbit = this.config.radiusX * Math.cos(theta);
            const y_orbit = this.config.radiusY * Math.sin(theta);
            
            // 2. 3D 旋转矩阵变换 (模拟轨道倾斜)
            const y_rotX = y_orbit * cos65;
            const z_rotX = y_orbit * sin65;
            
            const x_final = x_orbit * cos25 - y_rotX * sin25;
            const y_final = x_orbit * sin25 + y_rotX * cos25;
            const z_final = z_rotX;

            // 3. 透视投影
            const scale = this.config.perspective / (this.config.perspective - z_final);
            
            // 4. 应用样式 (使用 translate(-50%, -50%) 因为移除了父级的 transform)
            sat.style.transform = `translate(-50%, -50%) translate3d(${x_final}px, ${y_final}px, 0) scale(${scale})`;
            
            // 5. 【关键修复】遮挡逻辑：默认在后，变大(向前)时在前
            // z_final > 0 表示在轨道前半段 (靠近屏幕)
            if (z_final > 0) {
                sat.style.zIndex = 20; // 跑到星球前面
            } else {
                sat.style.zIndex = 5;  // 默认在星球后面
            }
        });
    },

    setupHoverEffects: function() {
        this.satellites.forEach(sat => {
            sat.addEventListener('mouseenter', () => {
                if (sat.classList.contains('focusing')) return;
                const match = sat.style.transform.match(/scale\(([\d.]+)\)/);
                const currentScale = match ? parseFloat(match[1]) : 1;
                sat.style.transform = sat.style.transform.replace(/scale\([\d.]+\)/, `scale(${currentScale * 1.3})`);
            });
        });
    }
};

// ===== 页面导航 =====
function navigate(page) {
    window.location.hash = page;
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[onclick*="${page}"]`);
    if (activeNav) activeNav.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== 模块选择动画 =====
function selectModule(target) {
    const mainStar = document.getElementById('main-star');
    const satellite = document.querySelector(`.satellite[data-target="${target}"]`);
    const allSatellites = document.querySelectorAll('.satellite');
    const homePage = document.getElementById('page-home');
    
    if (!mainStar || !satellite || !homePage) {
        navigate(target);
        return;
    }
    
    // 暂停 JS 动画循环
    SatelliteSystem.isRunning = false;
    
    mainStar.classList.add('shake');
    
    setTimeout(() => {
        mainStar.classList.remove('shake');
        satellite.classList.add('focusing');
        
        allSatellites.forEach(sat => {
            if (sat !== satellite) {
                sat.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
                sat.style.opacity = '0';
                sat.style.transform += ' scale(0)';
            }
        });
        
        mainStar.classList.add('fading-out');
        mainStar.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        mainStar.style.opacity = '0';
        mainStar.style.transform = 'scale(0.5)';
        
        document.querySelectorAll('.orbit-path').forEach(o => o.style.opacity = '0');
        
        setTimeout(() => {
            // 将选中卫星移到屏幕中心，并放大 4 倍
            satellite.style.transition = 'transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
            satellite.style.zIndex = '1000';
            satellite.style.transform = `translate(-50%, -50%) translate3d(0px, 0px, 0) scale(4)`;
            
            // 样式调整
            const icon = satellite.querySelector('.satellite-icon');
            if(icon) { 
                icon.style.transition = 'transform 1.5s'; 
                icon.style.transform = 'scale(1)'; 
            }
            
            // 修复：向下推并限制文字大小，防止遮挡
            const labelContainer = satellite.querySelector('.satellite-label-container');
            if(labelContainer) { 
                labelContainer.style.transition = 'transform 1.5s'; 
                labelContainer.style.transform = 'translateX(-50%) translateY(30px)'; 
            }
            
            const label = satellite.querySelector('.satellite-label');
            if(label) { 
                label.style.transition = 'all 1.5s'; 
                label.style.fontSize = '0.5rem'; // 在 scale(4) 下相当于 2rem
                label.style.padding = '0.25rem 0.5rem'; 
            }
            
            homePage.style.transition = 'background 1.5s ease-out';
            homePage.style.background = 'radial-gradient(ellipse at center, rgba(96, 165, 250, 0.3) 0%, #090a0f 100%)';
            
            setTimeout(() => {
                navigate(target);
                
                // 恢复状态，以便下次返回
                setTimeout(() => {
                    SatelliteSystem.startTime = Date.now();
                    SatelliteSystem.isRunning = true;
                    
                    allSatellites.forEach(sat => {
                        sat.classList.remove('focusing');
                        sat.style.transition = ''; sat.style.opacity = ''; sat.style.transform = ''; sat.style.zIndex = '';
                    });
                    
                    mainStar.classList.remove('fading-out');
                    mainStar.style.transition = ''; mainStar.style.opacity = ''; mainStar.style.transform = ''; mainStar.style.zIndex = '10'; // 恢复主星层级
                    
                    document.querySelectorAll('.orbit-path').forEach(o => o.style.opacity = '');
                    homePage.style.transition = ''; homePage.style.background = '';
                    
                    if(icon) icon.style.transform = '';
                    if(labelContainer) labelContainer.style.transform = '';
                    if(label) { label.style.fontSize = ''; label.style.padding = ''; }
                }, 500);
            }, 1500);
        }, 800);
    }, 500);
}

// ===== 初始化逻辑 =====
function initApp() {
    initExperimentCards();
    createStars();
    initEyeTracking();
    SatelliteSystem.init(); // 启动卫星
    
    updateAbacus();
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    
    // 初始化排序速度滑块
    const speedInput = document.getElementById('sort-speed');
    if (speedInput) {
        speedInput.addEventListener('input', (e) => {
            sortSpeed = parseInt(e.target.value);
            document.getElementById('speed-value').textContent = sortSpeed + 'ms';
        });
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function initExperimentCards() {
    Object.keys(CONFIG.experiments).forEach(cat => {
        const container = document.getElementById(`${cat}-experiments`);
        if (!container) return;
        container.innerHTML = CONFIG.experiments[cat].map(exp => `
            <div class="experiment-card glass" onclick="openExperiment('${exp.id}')">
                <div class="experiment-icon ${exp.color}"><i data-lucide="${exp.icon}"></i></div>
                <h3>${exp.title}</h3><p>${exp.description}</p>
                <span class="experiment-status">即将推出</span>
            </div>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}

function openExperiment(id) { alert(`实验 "${id}" 正在开发中！`); }
function handleHashChange() { navigate(window.location.hash.slice(1) || 'home'); }

// 星星背景
function createStars() {
    const bg = document.getElementById('stars-bg');
    if(!bg) return;
    for(let i=0; i<200; i++) {
        const s = document.createElement('div');
        s.className = 'star ' + (Math.random()<0.5?'small':Math.random()<0.8?'medium':'large');
        s.style.left = Math.random()*100+'%'; s.style.top = Math.random()*100+'%';
        s.style.animationDelay = Math.random()*3+'s';
        bg.appendChild(s);
    }
}

// 眼睛跟随
function initEyeTracking() {
    const main = document.getElementById('main-star');
    const pl = document.getElementById('pupil-left');
    const pr = document.getElementById('pupil-right');
    if(!main) return;
    document.addEventListener('mousemove', e => {
        const rect = main.getBoundingClientRect();
        const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.min(Math.sqrt(dx*dx+dy*dy), 40);
        const ang = Math.atan2(dy, dx);
        const mx = Math.cos(ang) * Math.min(dist/10, 4);
        const my = Math.sin(ang) * Math.min(dist/10, 4);
        pl.style.transform = pr.style.transform = `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))`;
    });
}

// 算筹逻辑
function numberToAbacus(n) {
    const s = []; let r = n;
    if(r>=10) {
        const t = Math.floor(r/10);
        for(let i=0;i<Math.floor(t/5);i++) s.push({type:'h',v:5});
        for(let i=0;i<t%5;i++) s.push({type:'v',v:1});
        r%=10;
    }
    for(let i=0;i<Math.floor(r/5);i++) s.push({type:'v',v:5});
    for(let i=0;i<r%5;i++) s.push({type:'h',v:1});
    return s;
}
function renderAbacus(id, n) {
    const c = document.getElementById(id);
    if(!c) return;
    c.innerHTML = '';
    const s = numberToAbacus(n);
    if(!s.length) c.innerHTML = '<span style="color:#94a3b8">0</span>';
    s.forEach((k,i) => {
        const d = document.createElement('div');
        d.className = `stick ${k.type==='h'?'horizontal':''}`;
        d.style.animationDelay = i*0.1+'s';
        c.appendChild(d);
    });
}
function updateAbacus() {
    renderAbacus('abacus-num1', parseInt(document.getElementById('num1').value)||0);
    renderAbacus('abacus-num2', parseInt(document.getElementById('num2').value)||0);
}
function calculateAbacus() {
    const n1 = parseInt(document.getElementById('num1').value)||0;
    const n2 = parseInt(document.getElementById('num2').value)||0;
    const op = document.getElementById('operator').value;
    renderAbacus('abacus-result', op==='add' ? n1+n2 : Math.max(0, n1-n2));
}

// 桶排序
let sortArray = [], isSorting = false, sortSpeed = 500;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function updateSortInfo(t) { const el = document.getElementById('sort-info'); if(el) el.textContent = t; }
function clearBuckets() { const el = document.getElementById('buckets-container'); if(el) el.innerHTML = ''; }

function generateRandomArray() {
    if(isSorting) return;
    sortArray = Array.from({length:15}, () => Math.floor(Math.random()*100)+1);
    renderArray('original-array', sortArray);
    renderArray('sorted-array', []);
    clearBuckets();
    updateSortInfo('点击"开始排序"');
}

function renderArray(id, arr) {
    const c = document.getElementById(id);
    if(!c) return;
    c.innerHTML = '';
    const max = Math.max(...arr, 1);
    arr.forEach(v => {
        const b = document.createElement('div');
        b.className = 'array-bar';
        b.style.height = (v/max*180)+'px';
        b.textContent = v;
        c.appendChild(b);
    });
}

function renderBuckets(buckets) {
    const c = document.getElementById('buckets-container');
    if(!c) return;
    c.innerHTML = '';
    buckets.forEach((b, i) => {
        const el = document.createElement('div');
        el.className = 'bucket';
        el.innerHTML = `<div class="bucket-label">桶 ${i+1}</div><div class="bucket-items">${b.map((v,j)=>`<div class="bucket-item" style="animation-delay:${j*0.1}s">${v}</div>`).join('')}</div>`;
        c.appendChild(el);
    });
}

function highlightBar(id, idx, on) {
    const bars = document.querySelectorAll(`#${id} .array-bar`);
    if(bars[idx]) on ? bars[idx].classList.add('active') : bars[idx].classList.remove('active');
}

async function startBucketSort() {
    if(isSorting || !sortArray.length) { if(!sortArray.length) { generateRandomArray(); await sleep(500); } else return; }
    isSorting = true;
    document.querySelectorAll('.sort-button').forEach(b => b.disabled = true);
    
    const arr = [...sortArray];
    const buckets = Array(10).fill(null).map(()=>[]);
    const max = Math.max(...arr);
    
    updateSortInfo('步骤1: 分配到桶...');
    for(let i=0; i<arr.length; i++) {
        const v = arr[i];
        const bi = Math.floor((v/(max+1))*10);
        buckets[bi].push(v);
        highlightBar('original-array', i, true);
        await sleep(sortSpeed);
        renderBuckets(buckets);
        updateSortInfo(`将 ${v} 放入桶 ${bi+1}`);
        await sleep(sortSpeed);
        highlightBar('original-array', i, false);
    }
    
    updateSortInfo('步骤2: 桶内排序...');
    for(let i=0; i<buckets.length; i++) {
        if(buckets[i].length) {
            buckets[i].sort((a,b)=>a-b);
            renderBuckets(buckets);
            updateSortInfo(`桶 ${i+1} 排序完成`);
            await sleep(sortSpeed);
        }
    }
    
    updateSortInfo('步骤3: 合并...');
    const sorted = [];
    for(let b of buckets) {
        for(let v of b) {
            sorted.push(v);
            renderArray('sorted-array', sorted);
            await sleep(sortSpeed/2);
        }
    }
    updateSortInfo('完成！');
    document.querySelectorAll('#sorted-array .array-bar').forEach((b,i)=>setTimeout(()=>b.classList.add('sorted'), i*50));
    isSorting = false;
    document.querySelectorAll('.sort-button').forEach(b => b.disabled = false);
}

function resetBucketSort() {
    if(isSorting) return;
    sortArray = [];
    renderArray('original-array', []); renderArray('sorted-array', []); clearBuckets();
    updateSortInfo('已重置');
}

// 启动
document.addEventListener('DOMContentLoaded', initApp);

// 导出全局
window.navigate = navigate;
window.selectModule = selectModule;
window.updateAbacus = updateAbacus;
window.calculateAbacus = calculateAbacus;
window.generateRandomArray = generateRandomArray;
window.startBucketSort = startBucketSort;
window.resetBucketSort = resetBucketSort;
window.openExperiment = openExperiment;