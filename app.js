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
    let isInitialized = false;

    // Initialize the app
    init();

    async function init() {
        if (isInitialized) return;
        
        // Generate a random peer ID
        currentPeerId = generatePeerId();
        generatedIdInput.value = currentPeerId;
        shareUrl = generateShareUrl(currentPeerId);
        modalCallLink.value = shareUrl;

        // Initialize PeerJS with more robust configuration
        peer = new Peer(currentPeerId, {
            host: 'peerjs-server-6tt6.onrender.com',
            port: 443,
            secure: true,
            pingInterval: 5000,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { 
                        urls: 'turn:global.turn.server:3478',
                        username: 'username',
                        credential: 'password'
                    }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('PeerJS connected with ID:', id);
            isInitialized = true;
            statusMessage.textContent = 'Ready to connect';
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            let errorMsg = 'Connection error';
            
            if (err.type === 'peer-unavailable') {
                errorMsg = 'Other peer unavailable. Check ID or ask them to join.';
            } else if (err.type === 'network') {
                errorMsg = 'Network issues. Check your internet connection.';
            } else if (err.type === 'webrtc') {
                errorMsg = 'WebRTC not supported. Try a different browser.';
            }
            
            showErrorDialog(errorMsg);
        });

        // Set up event listeners
        setupEventListeners();
        
        // Generate QR code
        generateQRCode();
        isInitialized = true;
        
        // Check for call ID in URL
        checkUrlForCallId();
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
            showErrorDialog('Could not access camera/microphone. Please check permissions.');
        }
    }

    async function joinExistingCall() {
        callId = joinCallIdInput.value.trim();
        if (!callId) {
            showErrorDialog('Please enter a call ID');
            return;
        }

        if (!peer || peer.disconnected) {
            await init();
        }

        try {
            // Get user media with better error handling
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                localVideo.srcObject = localStream;
            } catch (mediaError) {
                console.error('Media error:', mediaError);
                showErrorDialog('Could not access camera/microphone. Please check permissions.');
                return;
            }

            // Switch to call screen
            connectionScreen.classList.remove('active');
            callScreen.classList.add('active');
            
            statusMessage.textContent = 'Connecting...';
            participantCount.textContent = '1';
            isCaller = false;
            
            // Call the other peer with timeout
            const callPromise = peer.call(callId, localStream);
            
            // Set a timeout for the call attempt
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Connection timeout. Peer may not be available.'));
                }, 15000); // 15 seconds timeout
            });
            
            try {
                currentCall = await Promise.race([callPromise, timeoutPromise]);
                setupCallEventHandlers(currentCall);
                
                // Monitor connection state
                monitorConnectionState(currentCall);
            } catch (callError) {
                console.error('Call failed:', callError);
                let errorMessage = 'Error joining call';
                
                if (callError.message.includes('timeout')) {
                    errorMessage = callError.message;
                } else if (callError.type === 'peer-unavailable') {
                    errorMessage = 'Peer unavailable. Make sure they created a call.';
                }
                
                showErrorDialog(errorMessage);
                endCall();
            }
        } catch (err) {
            console.error('Error joining call:', err);
            showErrorDialog('Error joining call. Please check the call ID and try again.');
            endCall();
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
            showErrorDialog('Only one camera available');
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

    function monitorConnectionState(call) {
        const pc = call.peerConnection;
        
        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'disconnected' || 
                pc.iceConnectionState === 'failed') {
                showErrorDialog('Connection lost. Trying to reconnect...');
            }
        };
    }

    function showErrorDialog(message) {
        const errorDialog = document.createElement('div');
        errorDialog.className = 'error-dialog';
        errorDialog.innerHTML = `
            <div class="error-content">
                <h3>Error</h3>
                <p>${message}</p>
                <button class="error-ok-btn">OK</button>
            </div>
        `;
        
        document.body.appendChild(errorDialog);
        
        const okBtn = errorDialog.querySelector('.error-ok-btn');
        okBtn.addEventListener('click', () => {
            errorDialog.remove();
        });
    }

    function checkUrlForCallId() {
        const urlParams = new URLSearchParams(window.location.search);
        const callId = urlParams.get('call');
        if (callId) {
            joinCallIdInput.value = callId;
            // Auto-focus the join button for better UX
            setTimeout(() => {
                joinCallBtn.focus();
            }, 500);
        }
    }
});
