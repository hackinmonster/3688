document.addEventListener('DOMContentLoaded', async () => {
    // Function to preload and check all required assets
    function checkAssets() {
        const imagesToCheck = ['ad.png', 'back.png', 'insurance.png'];
        const videosToCheck = ['kanye.mp4', 'rogan.mp4', 'trump.mp4'];
        const audioToCheck = ['popup.mp3'];
        
        console.log("Checking asset availability...");
        
        // Check images
        imagesToCheck.forEach(img => {
            const image = new Image();
            image.onload = () => console.log(`✅ Image loaded successfully: ${img}`);
            image.onerror = () => console.error(`❌ Failed to load image: ${img}`);
            image.src = img;
        });
        
        // Check videos (just check if they exist, don't load them)
        videosToCheck.forEach(vid => {
            fetch(vid)
                .then(response => {
                    if (response.ok) {
                        console.log(`✅ Video accessible: ${vid}`);
                    } else {
                        console.error(`❌ Video not accessible: ${vid}, status: ${response.status}`);
                    }
                })
                .catch(error => console.error(`❌ Error checking video ${vid}:`, error));
        });
        
        // Check audio
        audioToCheck.forEach(aud => {
            fetch(aud)
                .then(response => {
                    if (response.ok) {
                        console.log(`✅ Audio accessible: ${aud}`);
                    } else {
                        console.error(`❌ Audio not accessible: ${aud}, status: ${response.status}`);
                    }
                })
                .catch(error => console.error(`❌ Error checking audio ${aud}:`, error));
        });
    }
    
    // Check assets on page load
    checkAssets();
    
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
    let microphoneStream = null;  // Store the microphone stream
    let hasShownBackAd = false;  // Flag to track if back ad has been shown
    let hasShownFeetAd = false;  // Flag to track if feet ad has been shown
    let hasShownInsuranceAd = false;  // Flag to track if insurance ad has been shown
    let originalPathData = '';  // Store original path data for the graph
    let micPermissionGranted = false;  // Track if microphone permission has been granted
    let hasShownMicPermissionAlert = false;
    let hasShownEndingScreen = false;  // Track if we've shown the ending screen
    
    // Initially hide the UIs
    lifesnatcher.style.display = 'none';
    socialbit.style.display = 'none';
    
    // Set initial mic button state
    micButton.textContent = 'Enable Microphone';
    micButton.disabled = false;

    // Check browser support for speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support speech recognition. Please use Chrome, Edge, or another modern browser.');
        console.error('Speech recognition not supported');
        return;
    }

    // Check if the user has already granted microphone permission
    async function checkMicrophonePermission() {
        if (micPermissionGranted || microphoneStream) {
            return true;
        }
        
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(device => device.kind === 'audioinput');
            
            // If we can get labels, permission is already granted
            if (audioDevices.length > 0 && audioDevices[0].label) {
                micPermissionGranted = true;
                return true;
            }
            
            return false;
        } catch (err) {
            console.error('Error checking microphone permission:', err);
            return false;
        }
    }

    async function requestMicrophonePermission() {
        // Check if we already have a stream
        if (microphoneStream) {
            return microphoneStream;
        }
        
        // Only request permission if explicitly needed (user clicked microphone button)
        try {
            microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micPermissionGranted = true;
            return microphoneStream;
        } catch (err) {
            if (!hasShownMicPermissionAlert) {
                alert('Microphone access is required for this application to work. Please allow microphone access and refresh the page.');
                hasShownMicPermissionAlert = true;
            }
            console.error('Microphone permission denied:', err);
            throw err;
        }
    }

    function initSpeechRecognition() {
        if (recognition) {
            // If recognition is already initialized, just make sure it's started
            if (isRecording && !micButton.classList.contains('active')) {
                try {
                    recognition.start();
                } catch (e) {
                    // Sometimes start() can throw if recognition is already running
                    console.log('Recognition already started:', e);
                }
            }
            return;  // Don't reinitialize if already exists
        }
        
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
            // Only attempt to restart if it was manually stopped and we're still recording
            if (isRecording) {
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Error restarting recognition:', e);
                }
            }
        };

        recognition.onresult = (event) => {
            const results = event.results;
            for (let i = event.resultIndex; i < results.length; i++) {
                if (results[i].isFinal) {
                    const transcript = results[i][0].transcript.toLowerCase();
                    const confidence = results[i][0].confidence;
                    
                    console.log("Recognized text:", transcript, "Confidence:", confidence); // Debug logging
                    
                    // Improve feet detection by checking for variations
                    if (transcript.includes('feet') || 
                        transcript.includes('feat') || 
                        transcript.includes('foot') || 
                        transcript.includes('feed')) {
                        console.log("'feet' or similar word detected in:", transcript);
                        if (!hasShownFeetAd) {
                            console.log("Feet trigger activated - showing ad");
                            showAd();
                        } else {
                            console.log("Feet ad already shown previously");
                        }
                    }
                    
                    if (transcript.includes('back') && !hasShownBackAd) {
                        console.log("'back' word detected - showing ad");
                        showBackAd();
                    }
                    
                    if (transcript.includes('insurance') && !hasShownInsuranceAd) {
                        console.log("'insurance' word detected - showing ad");
                        showInsuranceAd();
                    }
                    
                    if (transcript.includes('lately')) {
                        console.log("'lately' word detected - triggering effect");
                        handleLatelyTrigger();
                    }
                    
                    if (transcript.includes('compromise')) {
                        console.log("'compromise' word detected - triggering ending");
                        handleCompromiseTrigger();
                    }
                    
                    // Only add messages with decent confidence
                    if (confidence > 0.7) {
                        addMessage('You', transcript);
                    }
                }
            }
        };
    }
    
    // Initialize audio context and request microphone access
    async function initAudio() {
        try {
            // Only initialize audio context once
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
            }

            // Only request microphone permission when explicitly needed
            if (!microphoneStream) {
                microphoneStream = await requestMicrophonePermission();
            }
            
            // Only connect to analyser if not already connected
            if (microphoneStream && !isRecording) {
                const source = audioContext.createMediaStreamSource(microphoneStream);
                source.connect(analyser);
                
                // Update UI
                micButton.textContent = 'Microphone Active';
                micButton.classList.add('recording');
                playButton.style.display = 'inline-block';
                isRecording = true;
                
                // Start visualization and speech recognition
                drawVisualizer();
                initSpeechRecognition();
                if (recognition && !micButton.classList.contains('active')) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('Recognition may already be started:', e);
                    }
                }
                
                // Initialize social status
                updateSocialStatus(false);
            }
            
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
        
        // Set a timeout to update status to "Not Socializing" after 2 minutes of no messages
        clearTimeout(window.socialTimeout);
        window.socialTimeout = setTimeout(() => {
            updateSocialStatus(false);
        }, 120000); // 2 minutes = 120000 milliseconds
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
    
    // Generate realistic social interaction data for the month
    function generateMonthlyData() {
        const data = [];
        let baseValue = 0.5; // Start with 0.5 hours
        for (let i = 0; i < 16; i++) {  // Changed from 30 to 16 days
            // Add some randomness but maintain an upward trend
            const randomFactor = 0.9 + Math.random() * 0.4;
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
            // Scale x to stop at roughly 53% of the width (16/30 ≈ 0.53)
            const x = (i / 30) * svgWidth;
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
            inputs[0].value = 'Noah Briggs';
            inputs[1].value = '426-21-6789';
            inputs[2].value = '4102 2684 1249 9983';
        }, 6000);
        
        // Update medical history after 4 seconds
        setTimeout(() => {
            inputs[3].value = 'No significant medical history. Regular check-ups.';
        }, 8000);
        
        // Update physica   l data after 6-8 seconds
        setTimeout(() => {
            inputs[4].value = '6\'6"';
            inputs[5].value = '295 lbs';
            inputs[6].value = '62';
            inputs[7].value = 'O+';
            // Calculate and update BMI
            const heightInches = 71; // 5'11" in inches
            const weightLbs = 175;
            const bmi = (weightLbs / (heightInches * heightInches)) * 703;
            inputs[8].value = bmi.toFixed(1);
        }, 9000);
        
        // Update daily activities after 7 seconds
        setTimeout(() => {
            inputs[9].value = '620g of scrambled eggs, 171g of bacon, monster energy drink';
            inputs[10].value = 'bench press 405 lbs, 600 pushups, 1 minute treadmill';
            inputs[11].value = '4:45 PM - 5:15 AM';
        }, 7000);
        
        // Update social interaction fields after 8 seconds
        setTimeout(() => {
            inputs[12].value = '4';
            inputs[13].value = '5 minutes';
        }, 8000);
    }
    
    // Function to show ad for feet - simplify and make more robust
    function showAd() {
        console.log("showAd function called - FEET AD"); // Debug logging
        
        // Only show if it hasn't been shown before
        if (hasShownFeetAd) {
            console.log("Feet ad already shown, not showing again");
            return;
        }
        
        hasShownFeetAd = true;  // Mark as shown
        console.log("Showing feet ad NOW");
        
        // Create a backup plain element if the image doesn't load
        const backupAdElement = document.createElement('div');
        backupAdElement.style.width = '80%';
        backupAdElement.style.height = '400px';
        backupAdElement.style.background = 'red';
        backupAdElement.style.color = 'white';
        backupAdElement.style.display = 'flex';
        backupAdElement.style.alignItems = 'center';
        backupAdElement.style.justifyContent = 'center';
        backupAdElement.style.fontSize = '32px';
        backupAdElement.style.fontWeight = 'bold';
        backupAdElement.style.textAlign = 'center';
        backupAdElement.style.padding = '20px';
        backupAdElement.style.borderRadius = '10px';
        backupAdElement.innerHTML = 'ADVERTISEMENT<br>Special Offer for Feet Lovers!';
        
        // Ensure the ad popup is visible with higher z-index
        adPopup.style.display = 'flex';
        adPopup.style.visibility = 'visible';
        adPopup.style.zIndex = '9999';
        
        // Ensure the image is loaded and visible
        const adImage = adPopup.querySelector('.ad-image');
        if (adImage) {
            console.log("Ad image found:", adImage.src);
            
            // Set up error handling first
            adImage.onerror = () => {
                console.error("Ad image failed to load - using backup");
                // Replace with backup if image fails to load
                const adContent = adPopup.querySelector('.ad-content');
                if (adContent) {
                    // Keep the close button
                    const closeButton = adContent.querySelector('.ad-close');
                    adContent.innerHTML = '';
                    if (closeButton) adContent.appendChild(closeButton);
                    adContent.appendChild(backupAdElement);
                }
            };
            
            // Force reload the image with cache busting
            const timestamp = new Date().getTime();
            if (adImage.src.indexOf('?') >= 0) {
                adImage.src = adImage.src.split('?')[0] + '?t=' + timestamp;
            } else {
                adImage.src = adImage.src + '?t=' + timestamp;
            }
            
            adImage.style.display = 'block';
            adImage.onload = () => console.log("Ad image loaded successfully ✅");
        } else {
            console.error("Ad image element not found - using backup");
            // Use backup if image element doesn't exist
            const adContent = adPopup.querySelector('.ad-content');
            if (adContent) {
                // Keep the close button
                const closeButton = adContent.querySelector('.ad-close');
                adContent.innerHTML = '';
                if (closeButton) adContent.appendChild(closeButton);
                adContent.appendChild(backupAdElement);
            }
        }
        
        // Play popup sound
        try {
            const audio = new Audio('popup.mp3');
            audio.play()
                .then(() => {
                    // Play audio from kanye.mp4 after popup sound ends
                    audio.onended = () => {
                        console.log("Playing kanye.mp4 audio");
                        try {
                            const kanyeVideo = document.createElement('video');
                            kanyeVideo.src = 'kanye.mp4';
                            kanyeVideo.style.display = 'none';
                            document.body.appendChild(kanyeVideo);
                            
                            kanyeVideo.addEventListener('canplay', () => {
                                kanyeVideo.play()
                                    .then(() => console.log("Kanye video playback started"))
                                    .catch(err => console.error("Error playing kanye video:", err));
                            });
                            
                            kanyeVideo.onerror = () => {
                                console.error("Error loading kanye video");
                                document.body.removeChild(kanyeVideo);
                            };
                            
                            kanyeVideo.onended = () => {
                                console.log("Kanye video playback ended");
                                document.body.removeChild(kanyeVideo);
                            };
                        } catch (e) {
                            console.error("Error with kanye video:", e);
                        }
                    };
                })
                .catch(err => {
                    console.error("Error playing popup sound:", err);
                });
        } catch (e) {
            console.error("Error with audio:", e);
        }
    }
    
    // Function to hide ad
    function hideAd() {
        console.log("Hiding feet ad");
        adPopup.style.display = 'none';
        adPopup.style.visibility = 'hidden';
    }
    
    // Add event listener for ad close button
    adClose.addEventListener('click', hideAd);
    
    // Function to show sliding back ad
    function showBackAd() {
        // Only show if it hasn't been shown before
        if (hasShownBackAd) {
            return;
        }
        
        hasShownBackAd = true;  // Mark as shown
        backAd.style.display = 'block';
        
        // Play popup sound when ad appears
        const audio = new Audio('popup.mp3');
        audio.play();
        
        // Play rogan.mp4 audio after popup.mp3 ends
        audio.onended = () => {
            const video = document.createElement('video');
            video.src = 'rogan.mp4';
            video.style.display = 'none'; // Hide the video element
            document.body.appendChild(video);
            video.play();
            
            // Remove the video element when audio finishes
            video.onended = () => {
                document.body.removeChild(video);
            };
        };
        
        // Set a timeout to hide the ad
        setTimeout(() => {
            backAd.style.display = 'none';
        }, 5000);
    }
    
    // Function to update insurance ad position - keeps ad lower on screen with only slight horizontal movement
    function updateInsurancePosition() {
        if (!isInsuranceAdActive) return;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const adWidth = 800; // Match the width in CSS
        const adHeight = 800; // Match the height in CSS
        
        // Calculate position - center horizontally but in the bottom half of screen
        const centerX = (windowWidth - adWidth) / 2;
        const lowerY = windowHeight - adHeight - 50; // Position near bottom, 50px margin
        
        // Get current time for animation
        const time = Date.now() / 3000; // Faster movement for subtle effect
        
        // Create only horizontal oscillation around center
        const xOffset = Math.sin(time) * 30; // 30px movement horizontally (reduced)
        
        // Calculate final position - keep vertical position fixed in the lower area
        const x = Math.max(0, Math.min(windowWidth - adWidth, centerX + xOffset));
        const y = lowerY; // Fixed at lower position vertically
        
        // Apply the new position
        insuranceAd.style.left = x + 'px';
        insuranceAd.style.top = y + 'px';
        
        // Request the next animation frame
        if (isInsuranceAdActive) {
            requestAnimationFrame(updateInsurancePosition);
        }
    }
    
    // Function to show insurance ad
    function showInsuranceAd() {
        console.log("'insurance' word detected - showing ad");
        
        // Only show if it hasn't been shown before
        if (hasShownInsuranceAd) {
            console.log("Insurance ad already shown, not showing again");
            return;
        }
        
        hasShownInsuranceAd = true;  // Mark as shown
        isInsuranceAdActive = true;
        
        // Position ad in the lower part of the screen
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const adWidth = 800;
        const adHeight = 800;
        
        // Calculate position - center horizontally, position in bottom half of screen
        const posX = (windowWidth - adWidth) / 2;
        const posY = windowHeight - adHeight - 50; // 50px from bottom
        
        // Set position
        insuranceAd.style.left = posX + 'px';
        insuranceAd.style.top = posY + 'px';
        insuranceAd.style.display = 'block';
        
        // If window is too small, scale down the ad
        if (windowWidth < adWidth * 1.2 || windowHeight < adHeight * 1.2) {
            const scaleFactor = Math.min(
                windowWidth / adWidth * 0.9,
                windowHeight / adHeight * 0.9
            );
            
            const scaledWidth = adWidth * scaleFactor;
            const scaledHeight = adHeight * scaleFactor;
            
            insuranceAd.style.width = scaledWidth + 'px';
            insuranceAd.style.height = scaledHeight + 'px';
            
            // Recalculate position after scaling - maintain the lower position
            insuranceAd.style.left = ((windowWidth - scaledWidth) / 2) + 'px';
            insuranceAd.style.top = (windowHeight - scaledHeight - 50) + 'px'; // Keep 50px from bottom
        }
        
        // Play popup sound
        const audio = new Audio('popup.mp3');
        audio.play();
        
        // Start the movement animation
        requestAnimationFrame(updateInsurancePosition);
        
        // Play audio from trump.mp4 after popup sound ends
        audio.onended = () => {
            const trumpVideo = document.createElement('video');
            trumpVideo.src = 'trump.mp4';
            trumpVideo.style.display = 'none'; // Hide the video element
            document.body.appendChild(trumpVideo);
            trumpVideo.play();
            
            // Get audio duration or estimate if not available
            const estimatedDuration = 8000; // Assume 8 seconds if we can't get actual duration
            
            // Set up event listener to track when audio finishes
            trumpVideo.onended = () => {
                document.body.removeChild(trumpVideo);
                hideInsuranceAd();
            };
            
            // Also set a backup timer to hide the ad after the estimated duration
            // This makes the ad stay up for a shorter time
            setTimeout(() => {
                if (isInsuranceAdActive) {
                    document.body.removeChild(trumpVideo);
                    hideInsuranceAd();
                }
            }, estimatedDuration);
        };
    }
    
    // Function to hide insurance ad
    function hideInsuranceAd() {
        isInsuranceAdActive = false;
        insuranceAd.style.display = 'none';
        
        // Reset any size changes
        insuranceAd.style.width = '800px';
        insuranceAd.style.height = '800px';
    }
    
    // Handle mic button clicks
    micButton.addEventListener('click', async () => {
        if (isRecording) {
            // Stop recording
            if (recognition) {
                try {
                    recognition.stop();
                } catch (e) {
                    console.error('Error stopping recognition:', e);
                }
            }
            
            isRecording = false;
            micButton.textContent = 'Enable Microphone';
            micButton.classList.remove('recording');
            
            // Stop visualization
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        } else {
            // Start recording - explicitly disable button during the permission request
            // to prevent multiple clicks
            micButton.disabled = true;
            micButton.textContent = 'Requesting Microphone...';
            
            try {
                await initAudio();
                
                // Once we have mic access, proceed with normal app flow
                if (microphoneStream) {
                    // Play button visible after first microphone activation
                    playButton.style.display = 'inline-block';
                }
            } catch (e) {
                console.error('Error initializing audio:', e);
                micButton.textContent = 'Microphone Access Denied';
                micButton.disabled = false;
            }
        }
    });
    
    // Event listener for the play button
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

    // Add disconnection alert popup to the DOM
    const disconnectionAlert = document.createElement('div');
    disconnectionAlert.style.position = 'fixed';
    disconnectionAlert.style.top = '50%';
    disconnectionAlert.style.right = '20px';
    disconnectionAlert.style.transform = 'translateY(-50%)';
    disconnectionAlert.style.backgroundColor = 'rgba(150, 0, 0, 0.95)';
    disconnectionAlert.style.color = 'white';
    disconnectionAlert.style.padding = '35px'; // Increased padding
    disconnectionAlert.style.borderRadius = '15px'; // Increased rounded corners
    disconnectionAlert.style.boxShadow = '0 0 40px rgba(255, 0, 0, 0.8)'; // Enhanced glow effect
    disconnectionAlert.style.zIndex = '1000';
    disconnectionAlert.style.textAlign = 'center';
    disconnectionAlert.style.fontWeight = 'bold';
    disconnectionAlert.style.fontSize = '32px'; // Increased font size
    disconnectionAlert.style.display = 'none';
    disconnectionAlert.style.width = '40%'; // Make it wider
    disconnectionAlert.style.maxWidth = '600px'; // Increased max width
    disconnectionAlert.innerHTML = 'ALERT: EARLY SIGNS OF DISCONNECTION DETECTED'; // All caps for emphasis
    document.body.appendChild(disconnectionAlert);
    
    // Function to create sad beep sound
    function playSadBeep() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create oscillator for sad beep sound
        const oscillator1 = audioContext.createOscillator();
        oscillator1.type = 'sine';
        oscillator1.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator1.frequency.linearRampToValueAtTime(200, audioContext.currentTime + 0.5);
        
        // Create second oscillator for boop sound
        const oscillator2 = audioContext.createOscillator();
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(300, audioContext.currentTime + 0.6);
        oscillator2.frequency.linearRampToValueAtTime(150, audioContext.currentTime + 1.1);
        
        // Create gain node to control volume
        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1.2);
        
        // Connect nodes
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Start and stop oscillators
        oscillator1.start();
        oscillator1.stop(audioContext.currentTime + 0.6);
        oscillator2.start(audioContext.currentTime + 0.6);
        oscillator2.stop(audioContext.currentTime + 1.2);
        
        return audioContext.currentTime + 1.2; // Return time when sound ends
    }
    
    // Function to make the graph dip
    function makeGraphDip() {
        // Save original path data if not saved
        if (!originalPathData) {
            originalPathData = linePath.getAttribute('d');
        }
        
        // Get current path data
        const currentPath = linePath.getAttribute('d');
        
        // Instead of modifying the existing path, let's create a completely new path
        // by extending the original data with a dip
        const data = generateMonthlyData(); // Get the original data points
        
        // Create a copy of the data array
        const newData = [...data];
        
        // Add additional data points to show the dip (at around where the 17th point would be)
        // The last point in the data is index 15 (for 16 days)
        // Set a dramatic drop for the next point (where 17 would be)
        newData.push(data[data.length-1] * 0.4); // Drop to 40% of the last value
        
        // Generate the new path data
        const svgWidth = 100;
        const svgHeight = 100;
        const maxValue = 4; // Set max value to 4 hours
        const scaleY = svgHeight / maxValue;
        
        let pathData = `M 0 ${svgHeight - (newData[0] * scaleY)}`;
        for (let i = 1; i < newData.length; i++) {
            // For the original points, maintain the original x scaling
            // For the new point (index 16), place it at the end
            const x = (i < data.length) ? 
                     (i / 30) * svgWidth : 
                     (data.length / 30) * svgWidth;
            const y = svgHeight - (newData[i] * scaleY);
            pathData += ` L ${x} ${y}`;
        }
        
        linePath.setAttribute('d', pathData);
        
        // Restore original path after a delay
        setTimeout(() => {
            linePath.setAttribute('d', originalPathData);
        }, 5000);
    }
    
    // Function to handle disconnection alert
    function showDisconnectionAlert() {
        // Show alert
        disconnectionAlert.style.display = 'block';
        
        // Hide after 4 seconds
        setTimeout(() => {
            disconnectionAlert.style.display = 'none';
        }, 4000);
    }
    
    // Function to handle when "lately" is said
    function handleLatelyTrigger() {
        // Play sad beep-boop sound
        const soundEndTime = playSadBeep();
        
        // Make graph dip
        makeGraphDip();
        
        // Show disconnection alert after sound finishes
        setTimeout(() => {
            showDisconnectionAlert();
        }, 1200); // Match with sound duration
    }

    // Create ending screen div but don't add to the DOM yet
    const endingScreen = document.createElement('div');
    endingScreen.className = 'ending-screen';
    endingScreen.style.position = 'fixed';
    endingScreen.style.top = '0';
    endingScreen.style.left = '0';
    endingScreen.style.width = '100%';
    endingScreen.style.height = '100%';
    endingScreen.style.backgroundColor = 'black';
    endingScreen.style.color = 'white';
    endingScreen.style.display = 'flex';
    endingScreen.style.flexDirection = 'column';
    endingScreen.style.justifyContent = 'center';
    endingScreen.style.alignItems = 'center';
    endingScreen.style.zIndex = '10000';
    endingScreen.style.opacity = '0';
    endingScreen.style.transition = 'opacity 3s ease';
    endingScreen.innerHTML = `
        <h1 style="font-size: 6rem; margin-bottom: 2rem; text-align: center; font-weight: bold; letter-spacing: 1px;">SocialBit</h1>
        <p style="font-size: 2.5rem; text-align: center; max-width: 80%; line-height: 1.4;">Because loneliness shouldn't be invisible</p>
    `;
    
    // Function to handle when "compromise" is said
    function handleCompromiseTrigger() {
        if (hasShownEndingScreen) {
            return;
        }
        
        hasShownEndingScreen = true;
        
        // Add the ending screen to the DOM
        document.body.appendChild(endingScreen);
        
        // Force a reflow before setting opacity to ensure transition works
        endingScreen.offsetHeight;
        
        // Fade in the ending screen
        endingScreen.style.opacity = '1';
        
        // Stop any active audio/video
        if (audioContext) {
            audioContext.close();
        }
        
        // Stop speech recognition
        if (recognition) {
            recognition.stop();
        }
        
        // Stop any visualizations
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
}); 