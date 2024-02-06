const socket = io();

const localFace = document.getElementById('localFace');
const remoteFace = document.getElementById('remoteFace');
const muteBtn = document.getElementById('mute');
const cameraBtn = document.getElementById('camera');
const camerasSelect = document.getElementById('cameras');
const call = document.getElementById('call');

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		const cameras = devices.filter(device => device.kind === 'videoinput');
		const currentCamera = myStream.getVideoTracks()[0];

		cameras.forEach(camera => {
			const option = document.createElement('option');
			option.value = camera.deviceId;
			option.innerText = camera.label;
			currentCamera.label === camera.label && (option.selected = true);
			camerasSelect.appendChild(option);
		});
	} catch (e) {
		console.log(e);
	}
}

async function getMedia(deviceId) {
	const initialConstrains = {
		audio: true,
		video: { facingMode: 'user' }
	};

	const cameraConstraints = {
		audio: true,
		video: { deviceId: { exact: deviceId } }
	};

	try {
		myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstrains);
		localFace.srcObject = myStream;
		!deviceId && (await getCameras());
	} catch (e) {
		console.log(e);
	}
}

function handleMuteClick() {
	myStream //
		.getAudioTracks()
		.forEach(track => (track.enabled = !track.enabled));

	if (!muted) {
		muteBtn.innerText = 'Unmute';
		muted = true;
	} else {
		muteBtn.innerText = 'Mute';
		muted = false;
	}
}

function handleCameraClick() {
	myStream //
		.getVideoTracks()
		.forEach(track => (track.enabled = !track.enabled));

	if (cameraOff) {
		cameraBtn.innerText = 'Turn Camera Off';
		cameraOff = false;
	} else {
		cameraBtn.innerText = 'Turn Camera On';
		cameraOff = true;
	}
}

async function handleCameraChange() {
	await getMedia(camerasSelect.value);

	if (myPeerConnection) {
		const videoTrack = myStream.getVideoTracks()[0];
		const videoSender = myPeerConnection.getSenders().find(sender => sender.track.kind === 'video');
		videoSender.replaceTrack(videoTrack);
	}
}

muteBtn.addEventListener('click', handleMuteClick);
cameraBtn.addEventListener('click', handleCameraClick);
camerasSelect.addEventListener('input', handleCameraChange);

// Welcome Form (join a room)

const welcome = document.getElementById('welcome');
const welcomeForm = welcome.querySelector('form');

async function initCall() {
	welcome.hidden = true;
	call.hidden = false;
	await getMedia();
	makeConnection();
}

async function handleWelcomeSubmit(event) {
	event.preventDefault();
	const input = welcomeForm.querySelector('input');
	await initCall();
	socket.emit('join_room', input.value);
	roomName = input.value;
	input.value = '';
}

welcomeForm.addEventListener('submit', handleWelcomeSubmit);

// Socket Code

socket.on('welcome', async () => {
	const offer = await myPeerConnection.createOffer();
	myPeerConnection.setLocalDescription(offer);
	console.log('>>> sent the offer', offer);
	socket.emit('offer', offer, roomName);
});

socket.on('offer', async offer => {
	console.log('<<< recv the offer', offer);
	myPeerConnection.setRemoteDescription(offer);

	const answer = await myPeerConnection.createAnswer();
	myPeerConnection.setLocalDescription(answer);
	console.log('>>> sent the answer', answer);
	socket.emit('answer', answer, roomName);
});

socket.on('answer', async answer => {
	console.log('<<< recv the answer', answer);
	await myPeerConnection.setRemoteDescription(answer);
});

socket.on('ice', ice => {
	console.log('<<< recv candidate');
	myPeerConnection.addIceCandidate(ice);
});

// RTC Code

function makeConnection() {
	myPeerConnection = new RTCPeerConnection();
	myPeerConnection.addEventListener('icecandidate', handleIce);
	myPeerConnection.addEventListener('addstream', handleAddStream);
	myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
	console.log('sent candidate');
	socket.emit('ice', data.candidate, roomName);
}

function handleAddStream(data) {
	remoteFace.srcObject = data.stream;
}