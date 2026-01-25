import colors from 'colors';
import { DEBUG, INFO, ERRORS } from './index.js';

// Define valid color names supported by the library
export type ColorName = keyof colors.Color;

interface LogOptions {
  message: string;
  color?: ColorName;
  backgroundColor?: ColorName;
  args?: any[];
}

class Logger {
  private static instance: Logger;
  private readonly logLevel: string;

  // Centralize color mapping for the entire system
  public readonly colors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'yellow',
    DELETE: 'red',
    SYSTEM_INFO: 'magenta',
    SYSTEM_DEBUG: 'cyan',
    SYSTEM_WARNING: 'trap',
    SYSTEM_STATE_CHANGE: 'trap',
    SUCCESS: 'green',
    ERROR: 'red',
    ERROR_BACKGROUND: 'bgRed',
  } as const;

  private constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'error';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(severity: 'error' | 'info' | 'debug', options: LogOptions): void {
    const {
      message,
      color = 'white',
      backgroundColor = 'gray',
      args = [],
    } = options;
    const timestamp = new Date().toISOString();
    const rawMessage = `${timestamp} - ${message}`;
    // Apply color to the main message/label
    const coloredMessage = (colors as any)[color as ColorName](rawMessage);

    // Process args to handle Error objects correctly and prepare output
    const processedArgs: any[] = [];
    args.forEach(arg => {
      if (arg instanceof Error) {
        const stackLines = arg.stack?.split('\n') || [arg.message];
        stackLines.forEach(line => processedArgs.push(line));
      } else if (typeof arg === 'object' && arg !== null) {
        processedArgs.push(JSON.stringify(arg, null, 2)); // Pretty-print objects
      } else {
        processedArgs.push(arg);
      }
    });

    // Flatten processedArgs array
    const argString = processedArgs.length > 0 ? `\n${processedArgs.join('\n')}` : '';
    // Apply color to the args
    const coloredArgString = (colors as any)[color as ColorName](argString);

    // 4. Log to the console based on the severity check and respecting the log level settings
    if (severity === 'error' && ERRORS.includes(this.logLevel)) {
      console.info(coloredMessage);
      processedArgs.forEach(arg => {
        const coloredArg = (colors as any)[color as ColorName](`\t${arg.trim()}`);
        console.info(coloredArg);
      });
    } else if (severity === 'info' && INFO.includes(this.logLevel)) {
      console.info(`${coloredMessage}${coloredArgString}`);
    } else if (severity === 'debug' && DEBUG.includes(this.logLevel)) {
      console.debug(`${coloredMessage}${coloredArgString}`);
    }
  }

  public error(options: LogOptions): void {
    this.log('error', {
      color: this.colors.ERROR,
      backgroundColor: this.colors.ERROR_BACKGROUND,
      ...options
    });
  }

  public info(options: LogOptions): void {
    this.log('info', options);
  }

  public debug(options: LogOptions): void {
    this.log('debug', options);
  }
}

export const logger = Logger.getInstance();
