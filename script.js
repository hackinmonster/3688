document.addEventListener('DOMContentLoaded', () => {
    const micButton = document.getElementById('micButton');
    const playButton = document.getElementById('playButton');
    const lifesnatcher = document.getElementById('lifesnatcher');
    const socialbit = document.getElementById('socialbit');
    const linePath = document.querySelector('.line-path');
    const canvas = document.getElementById('visualizer');
    const canvasCtx = canvas.getContext('2d');
    const conversationList = document.querySelector('.conversation-list');
    const statusIndicator = document.querySelector('.status-indicator');
    const adPopup = document.getElementById('adPopup');
    const adClose = document.getElementById('adClose');
    const backAd = document.getElementById('backAd');
    const insuranceAd = document.getElementById('insuranceAd');
    
    let audioContext;
    let analyser;
    let dataArray;
    let animationId;
    let isRecording = false;
    let recognition;
    let isCurrentlySocializing = false;
    let isInsuranceAdActive = false;
    let insuranceAdTimeout;
    
    // Initially hide the UIs
    lifesnatcher.style.display = 'none';
    socialbit.style.display = 'none';
    
    // Check if we're on HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        alert('This application requires HTTPS to use speech recognition. Please access the site using HTTPS.');
        console.error('Speech recognition requires HTTPS');
    }

    // Check browser support for speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support speech recognition. Please use Chrome, Edge, or another modern browser.');
        console.error('Speech recognition not supported');
        return;
    }

    async function requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop the stream after permission check
            initSpeechRecognition();
        } catch (err) {
            alert('Microphone access is required for this application to work. Please allow microphone access and refresh the page.');
            console.error('Microphone permission denied:', err);
        }
    }

    function initSpeechRecognition() {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            console.log('Speech recognition started');
            micButton.classList.add('active');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings and refresh the page.');
            }
            micButton.classList.remove('active');
        };

        recognition.onend = () => {
            console.log('Speech recognition ended');
            micButton.classList.remove('active');
            // Attempt to restart if it wasn't manually stopped
            if (micButton.classList.contains('active')) {
                recognition.start();
            }
        };

        recognition.onresult = (event) => {
            const results = event.results;
            for (let i = event.resultIndex; i < results.length; i++) {
                if (results[i].isFinal) {
                    const transcript = results[i][0].transcript;
                    const confidence = results[i][0].confidence;
                    
                    // Check for trigger words in the transcript
                    if (transcript.toLowerCase().includes('feet')) {
                        showAd();
                    }
                    if (transcript.toLowerCase().includes('back')) {
                        showBackAd();
                    }
                    if (transcript.toLowerCase().includes('insurance')) {
                        showInsuranceAd();
                    }
                    
                    // Only add messages with decent confidence
                    if (confidence > 0.7) {
                        addMessage('You', transcript);
                    }
                }
            }
        };

        // Update mic button click handler
        micButton.addEventListener('click', () => {
            if (micButton.classList.contains('active')) {
                recognition.stop();
                micButton.classList.remove('active');
            } else {
                recognition.start();
                micButton.classList.add('active');
            }
        });
    }

    // Start by requesting microphone permission
    requestMicrophonePermission();
    
    // Function to update social status
    function updateSocialStatus(isSocializing) {
        isCurrentlySocializing = isSocializing;
        statusIndicator.textContent = isSocializing ? 'Socializing' : 'Not Socializing';
        statusIndicator.className = `status-indicator ${isSocializing ? 'active' : 'inactive'}`;
    }
    
    // Function to add a new message to the conversation
    function addMessage(speaker, text) {
        const message = document.createElement('p');
        message.className = 'message';
        message.textContent = `${speaker}: ${text}`;
        
        // Find the last conversation or create a new one
        let conversation = conversationList.querySelector('.conversation:last-child');
        if (!conversation) {
            conversation = createNewConversation();
        }
        
        const content = conversation.querySelector('.conversation-content');
        content.appendChild(message);
        content.scrollTop = content.scrollHeight;
        
        // Update social status when new message is added
        updateSocialStatus(true);
        
        // Set a timeout to update status to "Not Socializing" after 30 seconds of no messages
        clearTimeout(window.socialTimeout);
        window.socialTimeout = setTimeout(() => {
            updateSocialStatus(false);
        }, 30000);
    }
    
    // Function to create a new conversation
    function createNewConversation() {
        const now = new Date();
        const conversation = document.createElement('div');
        conversation.className = 'conversation';
        conversation.innerHTML = `
            <div class="conversation-header">
                <span class="person">Live Conversation</span>
                <span class="time">${now.toLocaleTimeString()}</span>
            </div>
            <div class="conversation-content"></div>
        `;
        conversationList.appendChild(conversation);
        return conversation;
    }
    
    // Set up canvas size
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize audio context and request microphone access
    async function initAudio() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            source.connect(analyser);
            
            // Update UI
            micButton.textContent = 'Microphone Active';
            micButton.classList.add('recording');
            playButton.style.display = 'inline-block';
            isRecording = true;
            
            // Start visualization and speech recognition
            drawVisualizer();
            if (recognition) {
                recognition.start();
            }
            
            // Initialize social status
            updateSocialStatus(false);
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            micButton.textContent = 'Microphone Access Denied';
        }
    }
    
    // Draw the audio visualization
    function drawVisualizer() {
        animationId = requestAnimationFrame(drawVisualizer);
        
        const width = canvas.width;
        const height = canvas.height;
        
        analyser.getByteFrequencyData(dataArray);
        
        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, width, height);
        
        const barWidth = (width / dataArray.length) * 2.5;
        let barHeight;
        let x = 0;
        
        for(let i = 0; i < dataArray.length; i++) {
            barHeight = dataArray[i] / 2;
            
            const hue = (i / dataArray.length) * 360;
            canvasCtx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            
            // Draw mirrored bars
            canvasCtx.fillRect(x, height/2 - barHeight, barWidth, barHeight);
            canvasCtx.fillRect(x, height/2, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    // Generate realistic social interaction data for the month
    function generateMonthlyData() {
        const data = [];
        let baseValue = 0.5; // Start with 0.5 hours
        for (let i = 0; i < 30; i++) {
            // Add some randomness but maintain an upward trend
            const randomFactor = 0.9 + Math.random() * 0.2;
            const dailyValue = baseValue * randomFactor;
            data.push(dailyValue);
            // Increase the base value each day
            baseValue += 0.1;
        }
        return data;
    }
    
    // Update the line graph with the generated data
    function updateLineGraph(data) {
        const svgWidth = 100;
        const svgHeight = 100;
        const maxValue = 4; // Set max value to 4 hours
        const scaleY = svgHeight / maxValue;
        
        let pathData = `M 0 ${svgHeight - (data[0] * scaleY)}`;
        for (let i = 1; i < data.length; i++) {
            const x = (i / (data.length - 1)) * svgWidth;
            const y = svgHeight - (data[i] * scaleY);
            pathData += ` L ${x} ${y}`;
        }
        
        linePath.setAttribute('d', pathData);
    }
    
    // Function to update LifeSnatcher fields with fake data
    function updateLifeSnatcherFields() {
        const inputs = lifesnatcher.querySelectorAll('input, textarea');
        
        // Update personal info after 3 seconds
        setTimeout(() => {
            inputs[0].value = 'John Doe';
            inputs[1].value = '123-45-6789';
            inputs[2].value = '4111 1111 1111 1111';
        }, 3000);
        
        // Update medical history after 4 seconds
        setTimeout(() => {
            inputs[3].value = 'No significant medical history. Regular check-ups.';
        }, 4000);
        
        // Update physical data after 6-8 seconds
        setTimeout(() => {
            inputs[4].value = '5\'11"';
            inputs[5].value = '175 lbs';
            inputs[6].value = '32';
            inputs[7].value = 'O+';
            // Calculate and update BMI
            const heightInches = 71; // 5'11" in inches
            const weightLbs = 175;
            const bmi = (weightLbs / (heightInches * heightInches)) * 703;
            inputs[8].value = bmi.toFixed(1);
        }, 6000);
        
        // Update daily activities after 7 seconds
        setTimeout(() => {
            inputs[9].value = 'Ate lunch with friend, Thomas';
            inputs[10].value = '30-minute walk';
            inputs[11].value = '11:00 PM - 7:00 AM';
        }, 7000);
        
        // Update social interaction fields after 8 seconds
        setTimeout(() => {
            inputs[12].value = '6';
            inputs[13].value = '2 hours 30 minutes';
        }, 8000);
    }
    
    // Function to show ad
    function showAd() {
        adPopup.style.display = 'flex';
        // Play an annoying sound (optional)
        const audio = new Audio('data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=');
        audio.play();
    }
    
    // Function to hide ad
    function hideAd() {
        adPopup.style.display = 'none';
    }
    
    // Add event listener for ad close button
    adClose.addEventListener('click', hideAd);
    
    // Function to show sliding back ad
    function showBackAd() {
        backAd.style.display = 'block';
        setTimeout(() => {
            backAd.style.display = 'none';
        }, 5000);
    }
    
    // Function to update insurance ad position
    function updateInsurancePosition(e) {
        if (isInsuranceAdActive) {
            insuranceAd.style.left = e.clientX + 'px';
            insuranceAd.style.top = e.clientY + 'px';
        }
    }
    
    // Function to show insurance ad
    function showInsuranceAd() {
        isInsuranceAdActive = true;
        insuranceAd.style.display = 'block';
        document.addEventListener('mousemove', updateInsurancePosition);
        
        // Clear any existing timeout
        if (insuranceAdTimeout) {
            clearTimeout(insuranceAdTimeout);
        }
        
        // Set new timeout to hide the ad after 5 seconds
        insuranceAdTimeout = setTimeout(() => {
            hideInsuranceAd();
        }, 5000);
    }
    
    // Function to hide insurance ad
    function hideInsuranceAd() {
        isInsuranceAdActive = false;
        insuranceAd.style.display = 'none';
        document.removeEventListener('mousemove', updateInsurancePosition);
    }
    
    // Event Listeners
    micButton.addEventListener('click', initAudio);
    
    playButton.addEventListener('click', () => {
        // Hide the play button and show the UIs
        playButton.style.display = 'none';
        lifesnatcher.style.display = 'block';
        socialbit.style.display = 'block';
        
        // Generate and update the monthly data
        const monthlyData = generateMonthlyData();
        updateLineGraph(monthlyData);
        
        // Update LifeSnatcher fields with timed updates
        updateLifeSnatcherFields();
        
        // Update stats with realistic times
        const stats = socialbit.querySelectorAll('.stat p');
        const totalDailyTime = 150; // 2 hours 30 minutes in minutes
        const hours = Math.floor(totalDailyTime / 60);
        const minutes = totalDailyTime % 60;
        stats[0].textContent = `${hours} hours ${minutes} minutes`;
        
        // Calculate weekly average (slightly higher than daily)
        const weeklyAverage = totalDailyTime * 1.2;
        const weeklyHours = Math.floor(weeklyAverage / 60);
        const weeklyMinutes = Math.round(weeklyAverage % 60);
        stats[1].textContent = `${weeklyHours} hours ${weeklyMinutes} minutes`;
    });
}); 