import colors from 'colors'; // Import colors library for coloring the console output

const logger = (req, res, next) => {
    const messageColors = {
        GET: 'green',
        POST: 'blue',
        PUT: 'yellow',
        DELETE: 'red'
    }
    const color = messageColors[req.method] || 'white';
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.protocol}://${req.get('host')}${req.originalUrl}`[color]);
    next();
}

export default logger;
