document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const connectionScreen = document.getElementById('connection-screen');
    const callScreen = document.getElementById('call-screen');
    const generatedIdInput = document.getElementById('generatedId');
    const joinCallIdInput = document.getElementById('joinCallId');
    const newCallBtn = document.getElementById('newCallBtn');
    const joinCallBtn = document.getElementById('joinCallBtn');
    const copyIdBtn = document.getElementById('copyIdBtn');
    const shareLinkBtn = document.getElementById('shareLinkBtn');
    const qrCodeBtn = document.getElementById('qrCodeBtn');
    const qrModal = document.getElementById('qr-modal');
    const closeModal = document.querySelector('.close-modal');
    const qrCodeDiv = document.getElementById('qr-code');
    const modalCallLink = document.getElementById('modal-call-link');
    const modalCopyBtn = document.getElementById('modal-copy-btn');
    const remoteVideo = document.getElementById('remoteVideo');
    const localVideo = document.getElementById('localVideo');
    const toggleMicBtn = document.getElementById('toggleMicBtn');
    const toggleCameraBtn = document.getElementById('toggleCameraBtn');
    const endCallBtn = document.getElementById('endCallBtn');
    const switchCameraBtn = document.getElementById('switchCameraBtn');
    const statusMessage = document.getElementById('status-message');
    const callTimer = document.getElementById('call-timer');
    const participantCount = document.getElementById('participant-count');

    // App State
    let peer;
    let currentCall;
    let localStream;
    let callStartTime;
    let timerInterval;
    let callId;
    let isCaller = false;
    let currentPeerId;
    let shareUrl;

    // Initialize the app
    init();

    async function init() {
        // Generate a random peer ID
        currentPeerId = generatePeerId();
        generatedIdInput.value = currentPeerId;
        shareUrl = generateShareUrl(currentPeerId);
        modalCallLink.value = shareUrl;

        // Initialize PeerJS
        peer = new Peer(currentPeerId, {
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('PeerJS connected with ID:', id);
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            statusMessage.textContent = 'Connection error. Please try again.';
        });

        // Set up event listeners
        setupEventListeners();
        
        // Generate QR code
        generateQRCode();
    }

    function setupEventListeners() {
        // Connection screen buttons
        newCallBtn.addEventListener('click', startNewCall);
        joinCallBtn.addEventListener('click', joinExistingCall);
        copyIdBtn.addEventListener('click', copyCallId);
        shareLinkBtn.addEventListener('click', shareCallLink);
        qrCodeBtn.addEventListener('click', showQRModal);
        closeModal.addEventListener('click', hideQRModal);
        modalCopyBtn.addEventListener('click', copyModalLink);

        // Call screen buttons
        toggleMicBtn.addEventListener('click', toggleMic);
        toggleCameraBtn.addEventListener('click', toggleCamera);
        endCallBtn.addEventListener('click', endCall);
        switchCameraBtn.addEventListener('click', switchCamera);
    }

    async function startNewCall() {
        try {
            // Get user media
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideo.srcObject = localStream;

            // Switch to call screen
            connectionScreen.classList.remove('active');
            callScreen.classList.add('active');
            
            // Set status
            statusMessage.textContent = 'Waiting for someone to join...';
            participantCount.textContent = '1';
            isCaller = true;
            callId = currentPeerId;
            
            // Listen for incoming calls
            peer.on('call', handleIncomingCall);
        } catch (err) {
            console.error('Error accessing media devices:', err);
            alert('Could not access camera/microphone. Please check permissions.');
        }
    }

    async function joinExistingCall() {
        callId = joinCallIdInput.value.trim();
        if (!callId) {
            alert('Please enter a call ID');
            return;
        }

        try {
            // Get user media
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideo.srcObject = localStream;

            // Switch to call screen
            connectionScreen.classList.remove('active');
            callScreen.classList.add('active');
            
            // Set status
            statusMessage.textContent = 'Connecting...';
            participantCount.textContent = '1';
            isCaller = false;
            
            // Call the other peer
            currentCall = peer.call(callId, localStream);
            setupCallEventHandlers(currentCall);
        } catch (err) {
            console.error('Error joining call:', err);
            alert('Error joining call. Please check the call ID and try again.');
        }
    }

    function handleIncomingCall(call) {
        currentCall = call;
        setupCallEventHandlers(call);
        
        // Answer the call with our local stream
        call.answer(localStream);
        
        // Update UI
        statusMessage.textContent = 'Call connected';
        startCallTimer();
        participantCount.textContent = '2';
    }

    function setupCallEventHandlers(call) {
        call.on('stream', (remoteStream) => {
            // Show remote video
            remoteVideo.srcObject = remoteStream;
            statusMessage.textContent = 'Call connected';
            startCallTimer();
            participantCount.textContent = '2';
        });

        call.on('close', endCall);
        call.on('error', (err) => {
            console.error('Call error:', err);
            statusMessage.textContent = 'Call ended';
            endCall();
        });
    }

    function endCall() {
        if (currentCall) {
            currentCall.close();
        }
        
        // Stop all tracks in local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Clear video sources
        remoteVideo.srcObject = null;
        localVideo.srcObject = null;
        
        // Stop timer
        clearInterval(timerInterval);
        callTimer.textContent = '00:00';
        
        // Reset call state
        currentCall = null;
        isCaller = false;
        
        // Return to connection screen
        callScreen.classList.remove('active');
        connectionScreen.classList.add('active');
        
        // Reinitialize for new call
        init();
    }

    function toggleMic() {
        if (!localStream) return;
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            toggleMicBtn.classList.toggle('active', audioTrack.enabled);
        }
    }

    function toggleCamera() {
        if (!localStream) return;
        
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleCameraBtn.classList.toggle('active', videoTrack.enabled);
        }
    }

    async function switchCamera() {
        if (!localStream) return;
        
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        // Get all video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length < 2) {
            alert('Only one camera available');
            return;
        }
        
        // Get current facing mode
        const constraints = videoTrack.getConstraints();
        const currentFacingMode = constraints.facingMode || 
                                (videoTrack.getSettings().facingMode || 'user');
        
        // Toggle between front and back camera
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Replace the video track
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: newFacingMode },
            audio: true
        });
        
        // Replace the video track in localStream
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStream.removeTrack(videoTrack);
        localStream.addTrack(newVideoTrack);
        localVideo.srcObject = localStream;
        
        // If in a call, replace the track being sent
        if (currentCall) {
            const sender = currentCall.peerConnection.getSenders()
                .find(s => s.track && s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
        }
        
        // Stop the unused stream
        newStream.getAudioTracks().forEach(track => track.stop());
    }

    function startCallTimer() {
        callStartTime = new Date();
        clearInterval(timerInterval);
        timerInterval = setInterval(updateCallTimer, 1000);
    }

    function updateCallTimer() {
        const now = new Date();
        const elapsed = Math.floor((now - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        callTimer.textContent = `${minutes}:${seconds}`;
    }

    function generatePeerId() {
        return Math.random().toString(36).substring(2, 8);
    }

    function generateShareUrl(callId) {
        return `${window.location.origin}${window.location.pathname}?call=${callId}`;
    }

    function copyCallId() {
        generatedIdInput.select();
        document.execCommand('copy');
        showTempMessage('Call ID copied!');
    }

    function copyModalLink() {
        modalCallLink.select();
        document.execCommand('copy');
        showTempMessage('Link copied!');
    }

    function showTempMessage(message) {
        const tempMsg = document.createElement('div');
        tempMsg.textContent = message;
        tempMsg.style.position = 'fixed';
        tempMsg.style.bottom = '20px';
        tempMsg.style.left = '50%';
        tempMsg.style.transform = 'translateX(-50%)';
        tempMsg.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        tempMsg.style.color = 'white';
        tempMsg.style.padding = '10px 20px';
        tempMsg.style.borderRadius = '20px';
        tempMsg.style.zIndex = '1000';
        document.body.appendChild(tempMsg);
        
        setTimeout(() => {
            tempMsg.remove();
        }, 2000);
    }

    function shareCallLink() {
        if (navigator.share) {
            navigator.share({
                title: 'Join my video call',
                text: 'Use this link to join my video call',
                url: shareUrl
            }).catch(err => {
                console.log('Error sharing:', err);
                showQRModal();
            });
        } else {
            showQRModal();
        }
    }

    function showQRModal() {
        qrModal.classList.add('active');
    }

    function hideQRModal() {
        qrModal.classList.remove('active');
    }

    function generateQRCode() {
        const qr = qrcode(0, 'L');
        qr.addData(shareUrl);
        qr.make();
        qrCodeDiv.innerHTML = qr.createImgTag(4);
    }

    // Check for call ID in URL
    function checkUrlForCallId() {
        const urlParams = new URLSearchParams(window.location.search);
        const callId = urlParams.get('call');
        if (callId) {
            joinCallIdInput.value = callId;
        }
    }

    // Initialize URL check
    checkUrlForCallId();
});
