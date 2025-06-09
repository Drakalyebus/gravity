const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);

const G = 9.8;
let offsetX = 0;
let offsetY = 0;
let scale = 1;
let isDragging = false;
let relocated = false;

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
    substract(vector) {
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
    static random() {
        const angle = Math.random() * 2 * Math.PI;
        return new Vector(Math.cos(angle), Math.sin(angle));
    }
}

let objects = [];

canvas.addEventListener('click', e => {
    if (!relocated) {
        const mass = +prompt("Enter the mass of the object", '1');
        objects.push({
            x: (e.offsetX - offsetX) / scale - mass * 10 / 5,
            y: (e.offsetY - offsetY) / scale,
            delta: Vector.random().multiply(0.1 / mass),
            radius: mass * 10,
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

    ctx.fillStyle = "rgb(0, 0, 0, 1)";
    ctx.fillRect(-offsetX / scale, -offsetY / scale, canvas.width / scale, canvas.height / scale);

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
        ctx.arc(object.x, object.y, Math.abs(object.radius), 0, 2 * Math.PI);
        ctx.fillStyle = object.color;
        ctx.fill();
    });

    gravity();

    requestAnimationFrame(draw);
}

draw();

let startX, startY;

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
