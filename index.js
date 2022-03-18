(function(global, func) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = func :
        typeof define === 'function' && define.amd ? define(func()) :
        (global = global || self, global.CanvasTable = func());
})(this, function() {

    // 单元格激活状态颜色
    const activeColor = "#30BEB6";
    const activeBgColor = "#F0F0F0";

    // 鼠标
    const mouse = {
        // 记录鼠标按下的事件
        firstTime: 0,
        // 记录鼠标抬起的时间
        lastTime: 0,
        // 鼠标状态
        state: false,
        // 存放鼠标拖动过的单元格
        mouseMoveList: [],
    }

    let startTime = "";
    // 填写框节点
    let inputNode = null;
    // 右键菜单节点
    let menuNode = null;
    // 溢出显示节点
    let tooltipNode = null;
    // canvas节点
    let canvas = null;
    // 画笔
    let ctx = null;
    // head数组最大层级
    let maxLvl = 1;
    // 用户上次点击的rowIndex colIndex
    let userPrevClickCoor = {};

    // 事件监听简化
    HTMLElement.prototype.on = function(event, callback) {
        this.addEventListener(event, callback);
    }

    // 绑定CSS
    HTMLElement.prototype.css = function(style) {
        for(let key in style) {
            this.style[key] = style[key];
        }
    }

    Object.prototype.isNull = function () {
        return Object.getOwnPropertyNames(this).length == 0;
    }

    function isArray(list) {
        let type = Object.prototype.toString.call(list);
        return type.slice(8, type.length - 1) == "Array";
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function error(msg) {
        console.error(msg);
    }

    // 数组降维
    function flatArr(list, newList) {
        for(let i = 0, len = list.length; i < len; i++) {
            if(list[i].child && list[i].child.length > 0) {
                flatArr(list[i].child, newList);
            } else {
                newList.push(list[i]);
            }
        }
        return newList;
    }

    // 创建canvas画布
    function createCanvas(node) {
        canvas = document.createElement('canvas');
        canvas.width = node.offsetWidth;
        canvas.height = node.offsetHeight;
        node.appendChild(canvas);
        ctx = canvas.getContext('2d');
        canvas = canvas;
    }

    // 创建tooltip
    function createTooltip(node) {
        tooltipNode = document.createElement("div");
        tooltipNode.className += "canvasTable-tootip";
        node.appendChild(tooltipNode);
    }

    // 创建菜单列表
    function createMenu(config, node) {
        let html = "<ul>";
        menuNode = document.createElement("div");
        menuNode.className += "canvasTable-menu";
        for(let i = 0, len = config.menu.length; i < len; i++) {
            html += `<li type="${config.menu[i].type}">${config.menu[i].label}</li>`;
        }
        html += "</ul>";
        menuNode.innerHTML = html;
        node.appendChild(menuNode);
        menuNode.on("click", e => {
            let type = e.target.getAttribute("type");
            switch(type) {
                case "delRow":
                    break;
                case "insertRow":
                    break;
                case "more":
                    break;
            }
        })
    }

    // 创建input
    function createInput(node) {
        inputNode = document.createElement("input");
        inputNode.className += "canvasTable-input";
        node.appendChild(inputNode);
    }

    // 判断当前单元格是否存在于数组中 鼠标移动过的单元格都会push进入数组
    function checkCellExistence(cell) {
        let num = 0;
        for(let i = 0; i < mouse.mouseMoveList.length; i++) {
            if(mouse.mouseMoveList[i].rowIndex != cell.rowIndex || mouse.mouseMoveList[i].colIndex != cell.colIndex) {
                num++;
            }
        }
        if(num == mouse.mouseMoveList.length) {
            mouse.mouseMoveList.push(cell);
            return true;
        }
        return false;
    }

    // 对用户点击位置进行匹配 判断是否与上次电机的位置相同
    // 两次点击的单元格不一样 清空上一个的颜色 修改当前点击的单元格颜色
    function checkUserClickCoor(config, cell) {
        if(userPrevClickCoor.isNull()) {
            userPrevClickCoor = cell;
            return true;
        }
        if(userPrevClickCoor.rowIndex == cell.rowIndex && userPrevClickCoor.colIndex == cell.colIndex) {
            return false;
        }
        updateCellState(config, userPrevClickCoor, false);
        userPrevClickCoor = cell;
        return true;
    } 

    // 修改单元格状态
    function updateCellState(config, cell, state) {
        clearRect(cell.col.x, (cell.rowIndex + maxLvl) * config.height, cell.col.width, config.height);
        draw(
            cell.col.x + 0.5, 
            (cell.rowIndex + maxLvl) * config.height + 0.5, 
            cell.col.width - 1, 
            config.height - 1, 
            cell.row[cell.col.variate], 
            2<<1, 
            {strokeColor: state ? activeColor : "", fillColor: state ? activeBgColor : ""}
        )
    }

    // 批量修改单元格状态
    function batchUpdateCellState(config, state) {
        let firstCell = mouse.mouseMoveList[0];
        let lastCell = mouse.mouseMoveList[mouse.mouseMoveList.length - 1];
        let lastPrevCell = mouse.mouseMoveList[mouse.mouseMoveList.length - 2];
        function update(first, last, state) {
            if(last.rowIndex >= first.rowIndex && last.colIndex >= first.colIndex) {// 右下
                for(let i = first.colIndex; i < config.flatHead.length; i++) {
                    for(let j = first.rowIndex; j < config.data.length; j++) {
                        if(i <= last.colIndex && j <= last.rowIndex) {
                            updateCellState(config, {rowIndex: j, colIndex: i, row: config.data[j], col: config.flatHead[i]}, state);
                        }
                    }
                }
            } else if(last.rowIndex >= first.rowIndex && last.colIndex <= first.colIndex) {// 左下
                for(let i = last.colIndex; i < config.flatHead.length; i++) {
                    for(let j = first.rowIndex; j < config.data.length; j++) {
                        if(i <= first.colIndex && j <= last.rowIndex) {
                            updateCellState(config, {rowIndex: j, colIndex: i, row: config.data[j], col: config.flatHead[i]}, state);
                        }
                    }
                }
            } else if(last.rowIndex <= first.rowIndex && last.colIndex >= first.colIndex) {// 右上
                for(let i = first.colIndex; i < config.flatHead.length; i++) {
                    for(let j = last.rowIndex; j < config.data.length; j++) {
                        if(i <= last.colIndex && j <= first.rowIndex) {
                            updateCellState(config, {rowIndex: j, colIndex: i, row: config.data[j], col: config.flatHead[i]}, state);
                        }
                    }
                }
            } else if(last.rowIndex <= first.rowIndex && last.colIndex <= first.colIndex) {// 左上
                for(let i = last.colIndex; i < config.flatHead.length; i++) {
                    for(let j = last.rowIndex; j < config.data.length; j++) {
                        if(i <= first.colIndex && j <= first.rowIndex) {
                            updateCellState(config, {rowIndex: j, colIndex: i, row: config.data[j], col: config.flatHead[i]}, state);
                        }
                    }
                }
            }
        }
        // clear
        if(mouse.mouseMoveList.length >= 3) update(firstCell, lastPrevCell, false);
        // update
        update(firstCell, lastCell, state);
        mouse.mouseMoveList = [firstCell, lastPrevCell, lastCell];
    }

    // 复制单元格数据
    function copyCellData() {
        inputNode.value = "";
        for(let i = mouse.mouseFirstCell.colIndex, len = this.config.flatHead.length; i < len; i++) {
            for(let j = mouse.mouseFirstCell.rowIndex, len = this.config.data.length; j < len; j++) {
                if(i <= mouse.mouseLastCell.colIndex && j <= mouse.mouseLastCell.rowIndex) {
                    inputNode.value += this.config.data[j][this.config.flatHead[i].variate] + "";
                }
            }
        }
        inputNode.select();
        inputNode.style.display = "block";
        document.execCommand("copy");
    }

    // 绘制单元格主方法
    function draw(x, y, width, height, label, type, style) {
        // type 绘制的类型
        // 2:头部   4:数据
        style = style || {};
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = style.strokeColor || "#cccccc";
        if(type == 2) {
            ctx.fillStyle = "#FFFFD8";
            ctx.fillRect(x, y, width, height);
        } else if(type == 4) {
            ctx.fillStyle = style.fillColor || "#ffffff";
            ctx.fillRect(x, y, width, height);
        }
        ctx.strokeRect(x, y, width, height);
        ctx.closePath();
        ctx.beginPath();
        ctx.font = "12px 微软雅黑";
        ctx.fillStyle = style.fontColor || "#555555";
        ctx.textAlign = "left";
        let strLength = Math.ceil(width / 15);
        if((type == 4) && label.length > strLength) {
            label = label.slice(0, strLength - 1) + "...";
        }
        ctx.fillText(label, (width / 10) + x, (height / 2) + y + 5);
        ctx.closePath();
    }

    // 清空画布指定区域
    function clearRect(x, y, width, height) {
        ctx.clearRect(x, y, width, height);
    }

    // 递归计算width以及x
    function calcHeadItemWidth(_list, lvl) {
        // lvl 层级 表示当前数组属于第几层 从1开始
        // 获取表头最深的层级
        if(lvl > maxLvl) maxLvl = lvl;
        for(let i = 0, len = _list.length; i <len; i++) {
            let x = 0;
            let width = _list[i].width>>0 || _list[i].label.length * this.config.fontWidth;
            for(let j = 0; j < i; j++) {
                x += _list[j].width>>0 || _list[j].label.length * this.config.fontWidth;
            }
            Object.assign(_list[i], {x: x, width: width});
            if(_list[i].child && _list[i].child.length > 0) {
                // 这里使用闭包 
                // 确保每一层都有自己的lvl   lvl会导致位置计算异常
                (lvl => {
                    calcHeadItemWidth.call(this, _list[i].child, ++lvl);
                })(lvl);
                // 计算每个子集的宽度  修改父级的宽度
                // 父级的宽度 = 各个子集宽度相加
                let width = 0;
                for(let j = 0; j < _list[i].child.length; j++) {
                    width += _list[i].child[j].width;
                }
                _list[i].width = width;
            }
        }
    }

    //递归计算表头的height以及y   并且对子集与父级进行x与width的校对
    function calcHeadItemHeightAndX(_list, lvl, startLvl) {
        for (let i = 0, len = _list.length; i <len; i++) {
            Object.assign(_list[i], {y: (startLvl - 1) * this.config.height, height: !_list[i].child ? lvl * this.config.height : this.config.height});
            if (_list[i].child && _list[i].child.length > 0) {
                //校对子集与父级的x以及width
                for (let j = 0; j < _list[i].child.length; j++) {
                    if (j == 0) _list[i].child[j].x = _list[i].x;
                    if (_list[i].child[j + 1]) _list[i].child[j + 1].x = _list[i].child[j].x + _list[i].child[j].width;
                }
                ((lvl, startLvl) => {
                    calcHeadItemHeightAndX.call(this, _list[i].child, --lvl, ++startLvl);
                })(lvl, startLvl)
            }
        }
    }

    // 添加键盘监听
    function bodyAddListenerKeyup(config) {
        document.body.on("keyup", e => {
            let code = e.keyCode;
            if(code == 27) {
                mouse.mouseMoveList.length > 0 && batchUpdateCellState(config, false);
                if(!userPrevClickCoor.isNull()) {
                    updateCellState(config, userPrevClickCoor, false);
                }
                menuNode.style.display = "none";
                inputNode.style.display = "none";
                tooltipNode.style.display = "none";
                mouse.mouseMoveList = [];
                userPrevClickCorr = {}
            }
            // 复制数据
            // if(code == 67 && e.ctrlKey) {
            //     copyCellData.call(this);
            // }
        })
    }

    // 添加click监听
    function canvasTableAddListenerClick(config, cell) {
        batchUpdateCellState(config, false);
        mouse.mouseMoveList = [];
        checkUserClickCoor(config, cell) && updateCellState(config, cell, true);
        inputNode.style.display = "none";
        menuNode.style.display = "none";
    }

    // 添加doubleClick监听
    function canvasTableAddListenerDblClick() {
        canvas.on("dblclick", e => {
            let x = e.offsetX;
            let y = e.offsetY;
            let cell = this.calcPosition(x, y);
            if(cell == "head" || cell == "overflow") return this;
            inputNode.setAttribute("row", cell.rowIndex);
            inputNode.setAttribute("col", cell.colIndex);
            inputNode.css({
                width: cell.col.width + "px",
                height: this.config.height + "px",
                top: (cell.rowIndex + 1 + maxLvl) * this.config.height - 10 + "px",
                left: cell.col.x + 19 + "px",
                display: "block"
            });
            inputNode.value = cell.row[cell.col.variate];
            inputNode.focus();
        })
    }

    // inputNode添加input监听
    function inputNodeAddLisenerInput(config) {
        inputNode.on("input", e => {
            let self = e.target;
            let row = self.getAttribute("row")>>0;
            let col = self.getAttribute("col")>>0;
            config.data[row][config.flatHead[col].variate] = self.value;
            updateCellState(config, {
                rowIndex: row,
                colIndex: col,
                row: config.data[row],
                col: config.flatHead[col]
            }, true)
        })
    }

    // 添加右键监听
    function canvasTableAddListenerContextmenu() {
        canvas.on("contextmenu", e => {
            e.preventDefault();
            let x = e.offsetX;
            let y = e.offsetY;
            let cell = this.calcPosition(x, y);
            if(cell == "head" || cell == "overflow") return this;
            checkUserClickCoor(this.config, cell) && updateCellState(this.config, cell, true);
            inputNode.style.display = "none";
            menuNode.css({
                display: "block",
                top: y + 20 + "px",
                left: x + 20 + "px"
            })
        })
    }

    // 鼠标按下监听
    function canvasTableAddListenerMousedown() {
        canvas.on("mousedown", e => {
            mouse.firstTime = new Date().getTime();
            mouse.state = true;
            let x = e.offsetX;
            let y = e.offsetY;
            let cell = this.calcPosition(x, y);
            if(cell == "head" || cell == "overflow") return this;
            if(mouse.mouseMoveList.length > 0) batchUpdateCellState(this.config, false);
            mouse.mouseMoveList = [];
            mouse.mouseMoveList.push(cell);
            if(!userPrevClickCoor.isNull()) updateCellState(this.config, userPrevClickCoor, false);
            userPrevClickCoor = {};
        })
    }

    // 添加鼠标移动监听
    function canvasTableAddListenerMousemove() {
        canvas.on("mousemove", e => {
            let x = e.offsetX;
            let y = e.offsetY;
            let cell = this.calcPosition(x, y);
            if(cell == "head" || cell == "overflow") return;
            if(mouse.state) {
                checkCellExistence(cell) && batchUpdateCellState(this.config, true);
            } else if(!mouse.state) {
                if(cell.col.width < cell.row[cell.col.variate].length * this.config.fontWidth) {
                    tooltipNode.innerHTML = cell.row[cell.col.variate];
                    tooltipNode.css({
                        display: "block",
                        top: ((cell.rowIndex + 1 + maxLvl) * this.config.height) - (tooltipNode.offsetHeight + 20) + "px",
                        left: cell.col.x + "px"
                    })
                } else {
                    tooltipNode.style.display = "none";
                }
            }
        })
    }

    // 添加鼠标抬起监听
    function canvasTableAddListenerMouseup() {
        canvas.on("mouseup", e => {
            mouse.lastTime = new Date().getTime();
            let time = mouse.lastTime - mouse.firstTime;
            let x = e.offsetX;
            let y = e.offsetY;
            let cell = this.calcPosition(x, y);
            if(cell == "head" || cell == "overflow") return this;
            if(time <= 200) {
                canvasTableAddListenerClick(this.config, cell);
            }
            mouse.state = false;
        })
    }

    // 创建canvasTable对象
    function CanvasTable(node) {
        startTime = new Date().getTime();
        console.log("start", startTime);
        this.node = node;
        createCanvas(node);
        // createTooltip(node);
    }

    // 对canvasTable对象设置默认配置
    // 设置默认配置之后就会对画布进行出屎化
    // 出屎化之后根据参数对画布进行数据绘制
    CanvasTable.prototype.setConfig = function(config) {
        if(!isArray(config.head)) {
            error("head need an array")
            return this;
        }
        if(!isArray(config.data)) {
            error("data need an array");
            return this;
        }
        this.config = config;
        this.init();
    }

    // 出屎化
    CanvasTable.prototype.init = function() {
        // 克隆一个表头数组用来存放递归之后的表头x,y,width,lineHeight,label
        this.config._head = clone(this.config.head);
        // 第一次递归获取最深的lvl并且进行第一次表头的计算（x，width）
        calcHeadItemWidth.call(this, this.config._head, 1, []);
        // 第二次递归计算高度并且对子集父级X轴进行校对
        calcHeadItemHeightAndX.call(this, this.config._head, maxLvl, 1);
        this.drawHead(this.config._head);
        // 对数组进行降维 数组递归显示数据会导致渲染效率降低
        this.config.flatHead = flatArr(this.config._head, []);
        this.drawData();
        if(this.config.edit) {
            canvasTableAddListenerDblClick.call(this);
            canvasTableAddListenerContextmenu.call(this);
            bodyAddListenerKeyup(this.config);
            createMenu(this.config, this.node);
            createInput(this.node);
            inputNodeAddLisenerInput(this.config);
        }
        canvasTableAddListenerMousedown.call(this);
        canvasTableAddListenerMousemove.call(this);
        canvasTableAddListenerMouseup.call(this);
        createTooltip(this.node);
        console.log(this.config);
        let endTime = new Date().getTime();
        console.log("end", endTime);
        console.log("finish", endTime - startTime);
    }

    // 递归绘制表头
    CanvasTable.prototype.drawHead = function(list) {
        for(let i = 0, len = list.length; i < len; i++) {
            draw(list[i].x, list[i].y, list[i].width, list[i].height, list[i].label, 2<<0);
            if(list[i].child && list[i].child.length > 0) {
                this.drawHead(list[i].child);
            }
        }
    }

    // 绘制数据
    CanvasTable.prototype.drawData = function() {
        for(let i = 0, len = this.config.flatHead.length; i < len; i++) {
            for(let j = 0, len2 = this.config.data.length; j < len2; j++) {
                draw(
                    this.config.flatHead[i].x,
                    (j + maxLvl) * this.config.height,
                    this.config.flatHead[i].width,
                    this.config.height,
                    this.config.data[j][this.config.flatHead[i].variate],
                    2<<1
                )
            }
        }
    }

    // 根据点击的位置计算当前点击的row，col以及cell
    CanvasTable.prototype.calcPosition = function(x, y) {
        let headMaxY = maxLvl * this.config.height;
        let cell = null;
        if(y >= 0 && y <= headMaxY) {
            return "head";
        }
        // 判断当前点击区域是不是表格显示数据的区域
        if(y > headMaxY && y <= this.config.height * (this.config.data.length + maxLvl)) {
            for(let i = 0; i < this.config.flatHead.length; i++) {
                for(let j = 0; j < this.config.data.length; j++) {
                    if(
                        (y >= (j + maxLvl) * this.config.height 
                        && y < (j + 1 + maxLvl) * this.config.height) 
                        && (x >= this.config.flatHead[i].x 
                            && x < this.config.flatHead[i].x + this.config.flatHead[i].width)) {
                        cell = {
                            row: this.config.data[j],
                            col: this.config.flatHead[i],
                            rowIndex: j,
                            colIndex: i,
                        }
                    }
                }
            }
            return cell;
        } else {
            return "overflow"
        }
    }


    return CanvasTable;
})