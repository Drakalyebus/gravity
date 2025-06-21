const canvas = document.getElementById('canvas');
const collisionCheckbox = document.getElementById('collision');
const dopplerCheckbox = document.getElementById('doppler');
const previewCheckbox = document.getElementById('preview');
const factorInput = document.getElementById('factor');
const localCheckbox = document.getElementById('local');
const lightInput = document.getElementById('light');
const pauseCheckbox = document.getElementById('pause');
const info = document.querySelector('.info-cont');
const okButton = document.getElementById('ok');
const GInput = document.getElementById('G');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

ctx.fillStyle = `rgb(${255 / 2}, ${255 / 2}, ${255 / 2}, 1)`;
ctx.fillRect(0, 0, canvas.width, canvas.height);

let G = 1;
let preview = true;
let previewRadius = 10;
let c = 299792458;
let maxSafeOffset = 0.01;
let dopplerFactor = 10;
let fps = 60;
let t = 0;
let dt = 1;
let offsetX = 0;
let offsetY = 0;
let scale = 1;
let dopplerEffect = true;
let localTime = true;
let isDragging = false;
let relocated = false;
let collision = false;
let maxForce = 0;
let followIds = [];
let onPause = false;

collisionCheckbox.addEventListener('change', () => {
    collision = collisionCheckbox.checked;
});
GInput.addEventListener('input', () => {
    G = +GInput.value;
    let newMaxForce = 0;
    objects.forEach(object => {
        const localMaxForce = Math.abs(G * object.mass) / object.radius ** 2;
        if (localMaxForce > newMaxForce) {
            newMaxForce = localMaxForce;
        }
    });
    maxForce = newMaxForce;
});
pauseCheckbox.addEventListener('change', () => {
    onPause = pauseCheckbox.checked;
});
dopplerCheckbox.addEventListener('change', () => {
    dopplerEffect = dopplerCheckbox.checked;
});
localCheckbox.addEventListener('change', () => {
    localTime = localCheckbox.checked;
});
lightInput.addEventListener('input', () => {
    c = +lightInput.value;
});
factorInput.addEventListener('input', () => {
    dopplerFactor = +factorInput.value;
});
okButton.addEventListener('click', () => {
    info.classList.add('none');
});
previewCheckbox.addEventListener('change', () => {
    preview = previewCheckbox.checked;
});

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(vector) {
        this.x += vector.x;
        this.y += vector.y;
        return this;
    }
    multiply(scalar) {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }
    subtract(vector) {
        this.x -= vector.x;
        this.y -= vector.y;
        return this;
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    normalize() {
        const length = this.length();
        this.x /= length;
        this.y /= length;
        return this;
    }
    reverse() {
        this.x *= -1;
        this.y *= -1;
        return this;
    }
    dot(vector) {
        return this.x * vector.x + this.y * vector.y;
    }
    static random() {
        const angle = Math.random() * 2 * Math.PI;
        const length = Math.random();
        return new Vector(Math.cos(angle) * length, Math.sin(angle) * length);
    }
}

let objects = [];

canvas.addEventListener('click', e => {
    if (!relocated) {
        const mass = +prompt("Enter the mass of the object", '1');
        const radius = Math.sqrt(Math.abs(mass) / Math.PI) * 10;
        const localMaxForce = Math.abs(G * mass) / radius ** 2;
        if (localMaxForce > maxForce) {
            maxForce = localMaxForce;
        }
        objects.push({
            x: (e.offsetX - offsetX) / scale,
            y: (e.offsetY - offsetY) / scale,
            delta: Vector.random().multiply(1 / mass),
            radius,
            mass,
            color: (360 / 10 * objects.length) % 360,
            localTime: t,
            localTimeDelta: dt,
            path: []
        });
    }
});

function gravity() {
    t += dt;
    objects = objects.map(object => {
        const newDelta = new Vector(0, 0);
        objects.filter(other => other !== object).forEach(other => {
            const direction = new Vector(other.x - object.x, other.y - object.y);
            const distance = Math.max(direction.length() - (object.radius + other.radius), object.radius + other.radius);
            const force = distance > 0 ? G * object.mass * other.mass / distance ** 2 : 0;
            direction.normalize();
            direction.multiply(force);
            newDelta.add(direction);
        });
        newDelta.multiply(1 / object.mass);
        object.delta.add(newDelta);
        return object;
    });
    if (collision) {
        objects.forEach(object => {
            objects.filter(other => other !== object).forEach(other => {
                if (Math.hypot(object.x - other.x, object.y - other.y) < object.radius + other.radius) {
                    const relativeSpeed = new Vector(object.delta.x - other.delta.x, object.delta.y - other.delta.y);
                    const direction = new Vector(other.x - object.x, other.y - object.y);
                    direction.normalize();
                    const speed = relativeSpeed.dot(direction);
                    if (speed > 0) {
                        const impulse = (2 * speed) / (object.mass + other.mass);
                        const impulseVector = new Vector(direction.x * impulse, direction.y * impulse);
                        const objectImpulse = new Vector(impulseVector.x * other.mass, impulseVector.y * other.mass);
                        const otherImpulse = new Vector(impulseVector.x * object.mass, impulseVector.y * object.mass);
                        object.delta.subtract(objectImpulse);
                        other.delta.add(otherImpulse);
                    }
                }
            });
        });
    }
    objects.forEach(object => {
        let speed = object.delta.length();
        if (speed > c - maxSafeOffset) {
            object.delta.normalize().multiply(c - maxSafeOffset);
            speed = c - maxSafeOffset;
        }
        const gamma = 1 / Math.sqrt(Math.max(1 - speed ** 2 / c ** 2, 0));
        const phi = -objects.filter(other => other !== object).reduce((acc, other) => {
            const distance = Math.max(Math.hypot(other.y - object.y, other.x - object.x), object.radius + other.radius);
            return acc + G * other.mass / distance;
        }, 0);
        const factor = Math.sqrt(Math.max(1 + 2 * phi / c ** 2, 0));
        object.localTimeDelta = factor * gamma * dt;
        object.x += object.delta.x;
        object.y += object.delta.y;
        object.localTime += object.localTimeDelta;
        if (!isFinite(object.localTime) || isNaN(object.localTime)) {
            object.localTime = 0;
        }
        object.path.push({x: object.x, y: object.y});
        if (object.path.length > 1000) {
            object.path.shift();
        }
    });
}

function calculateColor(object) {
    if (dopplerEffect) {
        const hue = object.color;
        const speed = object.delta.length();
        const shift = Math.sqrt(Math.max((1 + speed / c) / (1 - speed / c), 0)) - 1;
        const shiftedHue = (hue + shift * 360 / dopplerFactor);
        return `hsl(${Math.min(Math.max(shiftedHue, 0), 360)}deg, 100%, 50%)`;
    } else {
        return `hsl(${object.color}deg, 100%, 50%)`;
    }
}

function draw() {
    const rotateCoefficient = 2 * Math.PI / fps;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    if (followIds.length > 0) {
        const midX = followIds.reduce((acc, id) => acc + objects[id].x, 0) / followIds.length;
        const midY = followIds.reduce((acc, id) => acc + objects[id].y, 0) / followIds.length;
        const maxDistance = Math.max(...followIds.map(id => Math.hypot(midX - objects[id].x, midY - objects[id].y) + objects[id].radius));
        const minScreen = Math.min(canvas.width, canvas.height);
        if (followIds.length > 1) {
            scale = Math.min(minScreen / maxDistance / 2, scale);
        } else if (followIds.length === 1) {
            scale = Math.min(minScreen / objects[followIds[0]].radius / 2, scale);
        }
        offsetX = canvas.width / 2 - midX * scale;
        offsetY = canvas.height / 2 - midY * scale;
    }

    ctx.fillStyle = `rgb(${255 / 2}, ${255 / 2}, ${255 / 2}, 1)`;
    ctx.fillRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);

    const resolution = 20 / scale;
    const sizeX = canvas.width * 2 / scale;
    const sizeY = canvas.height * 2 / scale;
    for (let x = 0; x < sizeX; x += resolution) {
        for (let y = 0; y < sizeY; y += resolution) {
            const realX = x - offsetX / scale;
            const realY = y - offsetY / scale;
            let totalForce = 0;
            objects.forEach(object => {
                const direction = new Vector(realX - object.x, realY - object.y);
                const distance = Math.max(direction.length() - (object.radius), object.radius);
                const force = distance > 0 ? G * object.mass / distance ** 2 : 0;
                totalForce += force;
            });
            totalForce = Math.max(0, Math.min((totalForce / maxForce / -2 + 0.5) * 255, 255));
            ctx.fillStyle = `rgb(${totalForce}, ${totalForce}, ${totalForce})`;
            ctx.fillRect(realX - resolution / 2, realY - resolution / 2, resolution + 1, resolution + 1);
        }
    }

    if (localTime) {
        const pos = {
            x: (10 + previewRadius - offsetX) / scale,
            y: (10 + previewRadius - offsetY) / scale
        };
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.arc(pos.x, pos.y, previewRadius / scale, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1 / scale;
        ctx.lineCap = "round";
        ctx.lineTo(pos.x + Math.cos(t * rotateCoefficient) * previewRadius / scale, pos.y + Math.sin(t * rotateCoefficient) * previewRadius / scale);
        ctx.stroke();
    }

    objects.slice().sort((a, b) => b.radius - a.radius).forEach((object, index) => {
        ctx.beginPath();
        ctx.strokeStyle = calculateColor(object);
        ctx.lineWidth = 1;
        ctx.lineCap = "round";

        object.path.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });

        ctx.stroke();
        ctx.beginPath();
        ctx.arc(object.x, object.y, object.radius, 0, 2 * Math.PI);
        ctx.fillStyle = calculateColor(object);
        ctx.fill();
        if (localTime) {
            ctx.beginPath();
            ctx.moveTo(object.x, object.y);
            ctx.strokeStyle = "black";
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.lineTo(object.x + Math.cos(object.localTime * rotateCoefficient) * object.radius, object.y + Math.sin(object.localTime * rotateCoefficient) * object.radius);
            ctx.stroke();
        }
    });
    if (preview) {
        objects.forEach((object, index) => {
            ctx.beginPath();
            const pos = {
                x: (previewRadius + 10 + (index + localTime) * (previewRadius * 2 + 10) - offsetX) / scale,
                y: (10 + previewRadius - offsetY) / scale
            };
            ctx.fillStyle = calculateColor(object);
            ctx.arc(pos.x, pos.y, previewRadius / scale, 0, 2 * Math.PI);
            ctx.fill();
            if (localTime) {
                ctx.beginPath();
                ctx.moveTo(pos.x, pos.y);
                ctx.strokeStyle = "black";
                ctx.lineWidth = 1 / scale;
                ctx.lineCap = "round";
                ctx.lineTo(pos.x + Math.cos(object.localTime * rotateCoefficient) * previewRadius / scale, pos.y + Math.sin(object.localTime * rotateCoefficient) * previewRadius / scale);
                ctx.stroke();
            }
        });
    }

    if (!onPause) {
        gravity();
    }

    requestAnimationFrame(draw);
}

draw();

let startX, startY;

canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    let id = objects.findIndex(object => {
        const distance = Math.hypot((e.offsetX - offsetX) / scale - object.x, (e.offsetY - offsetY) / scale - object.y);
        return distance < object.radius;
    });
    if (id === -1 && preview) {
        id = objects.findIndex((object, index) => {
            const pos = {
                x: (previewRadius + 10 + (index + localTime) * (previewRadius * 2 + 10) - offsetX) / scale,
                y: (10 + previewRadius - offsetY) / scale
            };
            const distance = Math.hypot((e.offsetX - offsetX) / scale - pos.x, (e.offsetY - offsetY) / scale - pos.y) * scale;
            return distance < previewRadius;
        });
    }
    if (id !== -1) {
        if (followIds.includes(id)) {
            followIds.splice(followIds.indexOf(id), 1);
        } else {
            followIds.push(id);
        }
    }
});

canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
});

canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
        relocated = true;
        offsetX += (e.clientX - startX);
        offsetY += (e.clientY - startY);
        startX = e.clientX;
        startY = e.clientY;
    }
});

canvas.addEventListener("mouseup", () => { isDragging = false; setTimeout(() => relocated = false, 0) });

canvas.addEventListener("wheel", (e) => {
    e.preventDefault(); // Предотвращаем скролл страницы

    const zoomFactor = 1.1;
    const mouseX = e.clientX - canvas.offsetLeft;
    const mouseY = e.clientY - canvas.offsetTop;

    // Преобразуем координаты курсора в систему координат `canvas`
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    // Определяем направление масштабирования
    if (e.deltaY < 0) {
        scale *= zoomFactor; // Увеличение
    } else {
        scale /= zoomFactor; // Уменьшение
    }

    // Корректируем смещение так, чтобы приближение было относительно курсора
    offsetX = mouseX - worldX * scale;
    offsetY = mouseY - worldY * scale;
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});