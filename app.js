// Simple PeerJS implementation
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const callInput = document.getElementById('callId');
const callBtn = document.getElementById('callBtn');
const answerBtn = document.getElementById('answerBtn');

let peer;
let currentCall;

// Initialize
async function init() {
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        secure: true
    });

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
    });

    // Get local video stream
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    localVideo.srcObject = stream;

    // Handle incoming calls
    peer.on('call', (call) => {
        currentCall = call;
        call.answer(stream);
        call.on('stream', (remoteStream) => {
            remoteVideo.srcObject = remoteStream;
        });
    });
}

// Start call
callBtn.addEventListener('click', async () => {
    const stream = localVideo.srcObject;
    currentCall = peer.call(callInput.value, stream);
    currentCall.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
    });
});

init();
