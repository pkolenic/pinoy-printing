import colors from 'colors';
import { DEBUG, INFO, WARNING, ERRORS } from './index.js';

// Define valid color names supported by the library
export type ColorName = keyof colors.Color;

interface LogOptions {
  message: string;
  color?: ColorName;
  args?: any[];
  tenantId?: string;
}

class Logger {
  private static instance: Logger | undefined;
  private readonly logLevel: string;

  // Centralize color mapping for the entire system
  public readonly colors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'yellow',
    DELETE: 'red',
    SYSTEM_INFO: 'magenta',
    SYSTEM_DEBUG: 'cyan',
    SYSTEM_WARNING: 'bgYellow',
    SYSTEM_STATE_CHANGE: 'bgYellow',
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

  /**
   * Internal helper for testing to allow environment variable
   * changes to be picked up between test cases.
   */
  public static _resetInstance(): void {
    Logger.instance = undefined;
  }

  private log(severity: 'error' | 'warn' | 'info' | 'debug', options: LogOptions): void {
    const {
      message,
      color = 'white',
      args = [],
      tenantId = 'system',
    } = options;

    // 1. Determine if we should log based on the current level
    const shouldLog =
      (severity === 'error' && ERRORS.includes(this.logLevel)) ||
      (severity === 'warn' && WARNING.includes(this.logLevel)) ||
      (severity === 'info' && INFO.includes(this.logLevel)) ||
      (severity === 'debug' && DEBUG.includes(this.logLevel));

    if (!shouldLog) {
      return;
    }

    const timestamp = new Date().toISOString();

    // 2. Handle Production JSON format
    if (process.env.NODE_ENV === 'production') {
      // Structured JSON logging
      const logObject = {
        timestamp: timestamp,
        level: severity,
        tenantId: tenantId,
        message: message,
        data: args || []
      };
      console[severity === 'error' ? 'error' : 'log'](JSON.stringify(logObject));
      return;
    }

    // 3. Handle Development Colored format (the rest of your existing code...)
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
    if (severity === 'error') {
      console.error(coloredMessage);
      processedArgs.forEach(arg => {
        const coloredArg = (colors as any)[color as ColorName](`\t${arg.trim()}`);
        console.error(coloredArg);
      });
    } else if (severity === 'warn') {
      console.warn(`${coloredMessage}${coloredArgString}`);
    } else if (severity === 'info') {
      console.info(`${coloredMessage}${coloredArgString}`);
    } else if (severity === 'debug') {
      console.debug(`${coloredMessage}${coloredArgString}`);
    }
  }

  public error(options: LogOptions): void {
    this.log('error', {
      color: this.colors.ERROR,
      ...options
    });
  }

  public warn(options: LogOptions): void {
    this.log('warn', options);
  }

  public info(options: LogOptions): void {
    this.log('info', options);
  }

  public debug(options: LogOptions): void {
    this.log('debug', options);
  }
}

export const logger = Logger.getInstance();
export { Logger }; // Export the class for testing access to _resetInstance
