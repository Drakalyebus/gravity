const canvas = document.getElementById('canvas');
const collisionCheckbox = document.getElementById('collision');
const pauseCheckbox = document.getElementById('pause');
const GInput = document.getElementById('G');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

ctx.fillStyle = `rgb(${255 / 2}, ${255 / 2}, ${255 / 2}, 1)`;
ctx.fillRect(0, 0, canvas.width, canvas.height);

let G = 9.8;
let offsetX = 0;
let offsetY = 0;
let scale = 1;
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
});
pauseCheckbox.addEventListener('change', () => {
    onPause = pauseCheckbox.checked;
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
            color: `hsl(${(360 / 10 * objects.length) % 360}, 100%, 50%)`,
            path: []
        });
    }
});

function gravity() {
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
        object.x += object.delta.x;
        object.y += object.delta.y;
        object.path.push({x: object.x, y: object.y});
        if (object.path.length > 1000) {
            object.path.shift();
        }
    });
}

function draw() {
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
            ctx.fillRect(realX - resolution / 2, realY - resolution / 2, resolution, resolution);
        }
    }

    objects.sort((a, b) => b.mass - a.mass).forEach(object => {
        ctx.beginPath();
        ctx.strokeStyle = object.color;
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
        ctx.fillStyle = object.color;
        ctx.fill();
    });

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