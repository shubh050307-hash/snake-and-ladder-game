document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('board');
    const svgOverlay = document.getElementById('lines-overlay');
    const playerToken = document.getElementById('player');
    const diceElement = document.getElementById('dice');
    const rollBtn = document.getElementById('roll-btn');
    const restartBtn = document.getElementById('restart-btn');
    const statusMessage = document.getElementById('status-message');

    let currentPos = 0;
    let isMoving = false;
    let audioCtx = null;

    const snakes = [
        { start: 16, end: 6 },
        { start: 48, end: 26 },
        { start: 64, end: 60 },
        { start: 93, end: 73 },
        { start: 95, end: 75 },
        { start: 98, end: 78 }
    ];

    const ladders = [
        { start: 1, end: 38 },
        { start: 4, end: 14 },
        { start: 9, end: 31 },
        { start: 21, end: 42 },
        { start: 28, end: 84 },
        { start: 36, end: 44 }
    ];

    function initBoard() {
        board.innerHTML = '';
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                let cellNum;
                if (r % 2 === 0) {
                    cellNum = 100 - (r * 10) - c;
                } else {
                    cellNum = 100 - (r * 10) - 9 + c;
                }
                
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if ((r + c) % 2 !== 0) cell.classList.add('alt');
                cell.dataset.num = cellNum;
                cell.textContent = cellNum;
                board.appendChild(cell);
            }
        }
        setTimeout(drawConnections, 100); 
    }

    function drawConnections() {
        svgOverlay.innerHTML = '';
        const boardRect = board.getBoundingClientRect();

        const drawLine = (start, end, color, isSnake) => {
            const startCell = document.querySelector(`[data-num="${start}"]`);
            const endCell = document.querySelector(`[data-num="${end}"]`);
            if (!startCell || !endCell) return;

            const startRect = startCell.getBoundingClientRect();
            const endRect = endCell.getBoundingClientRect();

            const x1 = startRect.left - boardRect.left + startRect.width / 2;
            const y1 = startRect.top - boardRect.top + startRect.height / 2;
            const x2 = endRect.left - boardRect.left + endRect.width / 2;
            const y2 = endRect.top - boardRect.top + endRect.height / 2;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', '4');
            line.setAttribute('stroke-linecap', 'round');
            
            if (isSnake) {
                line.setAttribute('stroke-dasharray', '8, 8');
            }
            svgOverlay.appendChild(line);
        };

        snakes.forEach(s => drawLine(s.start, s.end, '#ef4444', true));
        ladders.forEach(l => drawLine(l.start, l.end, '#10b981', false));
        
        if (currentPos > 0) updatePlayerVisual(currentPos);
    }

    function linearSearchSnake(pos) {
        for (let i = 0; i < snakes.length; i++) {
            if (snakes[i].start === pos) return snakes[i].end;
        }
        return -1;
    }

    function binarySearchLadder(pos) {
        let left = 0;
        let right = ladders.length - 1;
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (ladders[mid].start === pos) return ladders[mid].end;
            if (ladders[mid].start < pos) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }

    function playSound(type) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        
        if (type === 'move') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'ladder') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'snake') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554, now + 0.2);
            osc.frequency.setValueAtTime(659, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 1);
            osc.start(now);
            osc.stop(now + 1);
        }
    }

    function updatePlayerVisual(pos) {
        if (pos === 0) {
            playerToken.style.transform = `translate(-100px, -100px)`;
            return;
        }
        const cell = document.querySelector(`[data-num="${pos}"]`);
        const boardRect = board.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();

        const x = cellRect.left - boardRect.left + (cellRect.width / 2);
        const y = cellRect.top - boardRect.top + (cellRect.height / 2);

        const tokenRect = playerToken.getBoundingClientRect();
        playerToken.style.transform = `translate(${x - (tokenRect.width / 2)}px, ${y - (tokenRect.height / 2)}px)`;
    }

    async function handleTurn() {
        if (isMoving || currentPos === 100) return;
        isMoving = true;
        rollBtn.disabled = true;

        statusMessage.style.color = 'var(--text-primary)';
        statusMessage.textContent = 'Rolling...';
        diceElement.classList.add('rolling');
        
        await new Promise(r => setTimeout(r, 600));
        
        const roll = Math.floor(Math.random() * 6) + 1;
        diceElement.classList.remove('rolling');
        diceElement.textContent = roll;

        if (currentPos + roll > 100) {
            statusMessage.textContent = `You need exactly ${100 - currentPos} to win!`;
            isMoving = false;
            rollBtn.disabled = false;
            return;
        }

        statusMessage.textContent = `Moved ${roll} spaces.`;

        for (let i = 1; i <= roll; i++) {
            currentPos++;
            updatePlayerVisual(currentPos);
            playSound('move');
            await new Promise(r => setTimeout(r, 300));
        }

        const snakeDest = linearSearchSnake(currentPos);
        const ladderDest = binarySearchLadder(currentPos);

        if (snakeDest !== -1) {
            statusMessage.style.color = 'var(--accent-red)';
            statusMessage.textContent = 'Oh no! Bitten by a snake!';
            playSound('snake');
            await new Promise(r => setTimeout(r, 500));
            currentPos = snakeDest;
            updatePlayerVisual(currentPos);
        } else if (ladderDest !== -1) {
            statusMessage.style.color = 'var(--accent-green)';
            statusMessage.textContent = 'Awesome! Climbed a ladder!';
            playSound('ladder');
            await new Promise(r => setTimeout(r, 500));
            currentPos = ladderDest;
            updatePlayerVisual(currentPos);
        }

        if (currentPos === 100) {
            statusMessage.style.color = 'var(--accent-blue)';
            statusMessage.textContent = '🎉 YOU WIN! 🎉';
            playSound('win');
        } else {
            rollBtn.disabled = false;
        }
        isMoving = false;
    }

    function resetGame() {
        currentPos = 0;
        diceElement.textContent = '🎲';
        statusMessage.style.color = 'var(--accent-green)';
        statusMessage.textContent = 'Roll the dice to start the game!';
        updatePlayerVisual(0);
        rollBtn.disabled = false;
        isMoving = false;
    }

    initBoard();
    window.addEventListener('resize', drawConnections);
    rollBtn.addEventListener('click', handleTurn);
    restartBtn.addEventListener('click', resetGame);
});