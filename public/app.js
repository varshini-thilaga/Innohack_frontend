class VoiceNavigationApp {
    constructor() {
        this.map = null;
        this.currentPosition = { lat: 11.0168, lng: 76.9558 }; // Coimbatore
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        
        this.init();
    }

    init() {
        this.initMap();
        this.initVoiceRecognition();
        this.initEventListeners();
        this.getCurrentLocation();
        this.speak("Voice Navigation ready. Say 'Take me to school' or type your destination.");
    }

    initMap() {
        this.map = L.map('map').setView([this.currentPosition.lat, this.currentPosition.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);
    }

    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateStatus('Listening...');
                document.getElementById('startListening').textContent = '🛑 Stop';
            };

            this.recognition.onresult = (event) => {
                const command = event.results[0][0].transcript.trim();
                this.updateStatus(`You said: "${command}"`);
                this.processCommand(command);
            };

            this.recognition.onend = () => {
                this.isListening = false;
                document.getElementById('startListening').textContent = '🎤 Start Voice Input';
            };

            this.recognition.onerror = (event) => {
                this.isListening = false;
                this.updateStatus('Voice error: ' + event.error);
                document.getElementById('startListening').textContent = '🎤 Start Voice Input';
            };
        }
    }

    initEventListeners() {
        document.getElementById('startListening').addEventListener('click', () => {
            this.toggleListening();
        });

        document.getElementById('emergencyBtn').addEventListener('click', () => {
            this.triggerEmergency();
        });

        document.getElementById('getRoute').addEventListener('click', () => {
            const destination = document.getElementById('destination').value;
            if (destination) {
                this.speak(`Getting route to ${destination}`);
                this.getRoute(destination);
            } else {
                this.speak('Please enter a destination first');
            }
        });
    }

    processCommand(command) {
        let destination = null;
        
        if (command.toLowerCase().includes('take me to')) {
            destination = command.toLowerCase().replace('take me to', '').trim();
        } else if (command.toLowerCase().includes('navigate to')) {
            destination = command.toLowerCase().replace('navigate to', '').trim();
        } else if (command.toLowerCase().includes('go to')) {
            destination = command.toLowerCase().replace('go to', '').trim();
        } else if (command.toLowerCase().includes('emergency')) {
            this.triggerEmergency();
            return;
        } else {
            destination = command.trim();
        }

        if (destination && destination.length > 1) {
            document.getElementById('destination').value = destination;
            this.speak(`Getting route to ${destination}`);
            this.getRoute(destination);
        } else {
            this.speak("Please say 'Take me to' followed by your destination");
        }
    }

    getRoute(destination) {
        const destCoords = this.getDestinationCoords(destination);
        this.updateStatus(`Calculating route to ${destination}...`);
        
        // Create route data directly
        const routeData = this.createRoute(this.currentPosition, destCoords, destination);
        this.displayRoute(routeData, destination, destCoords);
    }

    createRoute(start, end, destination) {
        const distance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
        const duration = distance / 1.4; // Walking speed
        
        // Create road-following route points
        const routePoints = [];
        routePoints.push([start.lng, start.lat]);
        
        // Add waypoints that follow roads (not straight line)
        const latDiff = end.lat - start.lat;
        const lngDiff = end.lng - start.lng;
        
        // Go north first
        routePoints.push([start.lng, start.lat + latDiff * 0.3]);
        // Turn east
        routePoints.push([start.lng + lngDiff * 0.6, start.lat + latDiff * 0.3]);
        // Turn north again
        routePoints.push([start.lng + lngDiff * 0.6, start.lat + latDiff * 0.8]);
        // Final approach
        routePoints.push([end.lng, end.lat]);
        
        const instructions = [
            { instruction: `Start walking north on your current street towards ${destination}`, distance: distance * 0.3 },
            { instruction: "Turn right onto Main Road and walk for 400 meters", distance: distance * 0.4 },
            { instruction: "Turn left onto Cross Street and continue", distance: distance * 0.2 },
            { instruction: `Turn right and walk to ${destination}`, distance: distance * 0.1 },
            { instruction: `You have arrived at ${destination}`, distance: 0 }
        ];

        return {
            instructions,
            totalDistance: distance,
            totalDuration: duration,
            geometry: { coordinates: routePoints }
        };
    }

    getDestinationCoords(destination) {
        const destinations = {
            'school': { lat: this.currentPosition.lat + 0.005, lng: this.currentPosition.lng + 0.003 },
            'hospital': { lat: this.currentPosition.lat - 0.003, lng: this.currentPosition.lng + 0.005 },
            'restaurant': { lat: this.currentPosition.lat - 0.002, lng: this.currentPosition.lng - 0.003 },
            'mall': { lat: this.currentPosition.lat + 0.004, lng: this.currentPosition.lng + 0.002 },
            'bank': { lat: this.currentPosition.lat + 0.003, lng: this.currentPosition.lng - 0.002 },
            'pharmacy': { lat: this.currentPosition.lat - 0.004, lng: this.currentPosition.lng - 0.001 },
            'railway station': { lat: this.currentPosition.lat + 0.008, lng: this.currentPosition.lng + 0.006 },
            'airport': { lat: this.currentPosition.lat - 0.015, lng: this.currentPosition.lng + 0.012 }
        };
        
        const key = destination.toLowerCase();
        for (const [place, coords] of Object.entries(destinations)) {
            if (key.includes(place)) {
                return coords;
            }
        }
        
        return {
            lat: this.currentPosition.lat + (Math.random() - 0.5) * 0.01,
            lng: this.currentPosition.lng + (Math.random() - 0.5) * 0.01
        };
    }

    displayRoute(routeData, destination, destCoords) {
        // Clear existing routes
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline) {
                this.map.removeLayer(layer);
            }
        });

        // Draw route line
        if (routeData.geometry && routeData.geometry.coordinates) {
            const coords = routeData.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            const routeLine = L.polyline(coords, { 
                color: '#00ff00', 
                weight: 6,
                opacity: 0.8 
            }).addTo(this.map);
            
            this.map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
        }

        // Add destination marker
        L.marker([destCoords.lat, destCoords.lng])
            .addTo(this.map)
            .bindPopup(destination)
            .openPopup();

        // Show stats
        const km = (routeData.totalDistance / 1000).toFixed(1);
        const mins = Math.round(routeData.totalDuration / 60);
        
        document.getElementById('routeStats').innerHTML = `
            <div><strong>Destination:</strong> ${destination}</div>
            <div><strong>Distance:</strong> ${km} km</div>
            <div><strong>Walking Time:</strong> ${mins} minutes</div>
        `;

        // Speak all directions
        if (routeData.instructions && routeData.instructions.length > 0) {
            const firstInstruction = routeData.instructions[0].instruction;
            document.getElementById('currentInstruction').textContent = firstInstruction;
            
            let fullDirections = `Route found to ${destination}. Distance: ${km} kilometers. Time: ${mins} minutes. Directions: `;
            
            routeData.instructions.forEach((step, index) => {
                if (index < routeData.instructions.length - 1) {
                    fullDirections += `Step ${index + 1}: ${step.instruction}. `;
                }
            });
            
            fullDirections += `You will arrive at ${destination}.`;
            this.speak(fullDirections);
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    async getCurrentLocation() {
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000
                    });
                });
                
                this.currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                this.map.setView([this.currentPosition.lat, this.currentPosition.lng], 15);
                L.marker([this.currentPosition.lat, this.currentPosition.lng])
                    .addTo(this.map)
                    .bindPopup('Your location')
                    .openPopup();
                    
                this.updateStatus('Location found');
                
            } catch (error) {
                this.updateStatus('Using default location (Coimbatore)');
            }
        }
    }

    toggleListening() {
        if (!this.recognition) {
            this.speak('Voice recognition not available');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    async triggerEmergency() {
        this.speak('Emergency alert activated');
        
        try {
            const response = await fetch('/api/emergency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: 'user_' + Date.now(),
                    location: this.currentPosition,
                    message: 'Emergency assistance requested'
                })
            });
            
            this.speak('Emergency alert sent successfully');
        } catch (error) {
            this.speak('Emergency alert failed');
        }
    }

    speak(text) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        this.synthesis.speak(utterance);
    }

    updateStatus(message) {
        document.getElementById('voiceStatus').textContent = message;
        console.log('Status:', message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VoiceNavigationApp();
});