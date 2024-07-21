const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const morgan = require('morgan');
const path = require('path');
const moment = require('moment-timezone'); // Include moment-timezone

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Logging middleware with Morgan
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));

// Serve static files from the root directory
app.use(express.static(__dirname));

// Serve the index.html file at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Load existing messages from JSON file
let messages = [];
try {
  messages = JSON.parse(fs.readFileSync('messages.json', 'utf8'));
} catch (err) {
  console.error('Error reading messages from file:', err);
}

// Function to remove expired messages older than 3 minutes
function removeExpiredMessages() {
  const expiryTime = 3 * 60 * 1000; // 3 minutes in milliseconds
  const currentTime = Date.now();

  messages = messages.filter(message => (currentTime - message.timestamp) <= expiryTime);

  // Update the JSON file with the filtered messages
  fs.writeFile('messages.json', JSON.stringify(messages), (err) => {
    if (err) {
      console.error('Error writing updated messages to file:', err);
    } else {
      console.log('Expired messages removed and file updated successfully');
    }
  });
}

// Periodically check for and remove expired messages (every minute)
setInterval(removeExpiredMessages, 1 * 60 * 1000); // Check every 1 minute

io.on('connection', (socket) => {
  console.log('New user connected');

  // Send existing messages to client
  socket.emit('load messages', messages);

  // Handle incoming messages
  socket.on('chat message', (msg) => {
    // Add timestamp to the message
    const messageWithTimestamp = {
      content: msg,
      timestamp: Date.now()
    };

    messages.push(messageWithTimestamp);

    // Broadcast the message to all connected clients
    io.emit('chat message', messageWithTimestamp);

    // Save message to JSON file
    fs.writeFile('messages.json', JSON.stringify(messages), (err) => {
      if (err) {
        console.error('Error writing message to file:', err);
      } else {
        console.log('Message saved to file');
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Log when a user opens the site with IST timestamp
app.use((req, res, next) => {
  const timestamp = moment().tz('Asia/Kolkata').format('[DD/MMM/YYYY:HH:mm:ss ZZ]');
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  // Extract device information from User-Agent header
  let deviceInfo = 'Unknown Device';
  if (userAgent) {
    if (userAgent.includes('Mobile')) {
      deviceInfo = 'Mobile Device';
    } else if (userAgent.includes('Tablet')) {
      deviceInfo = 'Tablet Device';
    } else {
      deviceInfo = 'Desktop Device';
    }
  }

  console.log(`[${timestamp}] User connected: ${ip} - Device: ${deviceInfo} - User-Agent: ${userAgent}`);

  next();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
