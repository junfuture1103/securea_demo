

const form = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatLogs = document.querySelector('.chatlogs');
let varTurnOffAll = 0;
let varBulb1 = 0;
let varBulb2 = 0;
let varBulb3 = 0;
let varBulb4 = 0;
form.addEventListener('submit', function(event) {
	event.preventDefault();

	const message = chatInput.value.trim();
	if (!message) {
		return;
	}

	addMessage(message);
	chatInput.value = '';
});

function addMessage(message, me) {
	const chatMessage = document.createElement('div');
	chatMessage.classList.add('chat-message');

	const chatText = document.createElement('div');
	chatText.classList.add('message');
	chatText.textContent = message;
	if (me) {
		chatText.style.textAlign = "right";
	}
	
	const chatTime = document.createElement('div');
	chatTime.classList.add('time');
	chatTime.textContent = getTimeStamp();
	if (me) {
		chatTime.style.textAlign = "right";
	}
	chatMessage.appendChild(chatText);
	chatMessage.appendChild(chatTime);

	chatLogs.appendChild(chatMessage);
	chatLogs.scrollTop = chatLogs.scrollHeight;
}

function getTimeStamp() {
	const date = new Date();
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const ampm = hours >= 12 ? 'PM' : 'AM';
	const formattedHours = hours % 12 || 12;
	const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

	return `${formattedHours}:${formattedMinutes} ${ampm}`;
}
