import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export class TimeZoneManager {
  constructor() {
    this.timezoneData = {
      'America/New_York': {
        name: 'Eastern Time',
        code: 'ET',
        country: 'United States',
        cities: ['New York', 'Atlanta', 'Miami'],
      },
      'America/Chicago': {
        name: 'Central Time',
        code: 'CT', 
        country: 'United States',
        cities: ['Chicago', 'Dallas', 'Houston'],
      },
      'America/Denver': {
        name: 'Mountain Time',
        code: 'MT',
        country: 'United States', 
        cities: ['Denver', 'Phoenix', 'Salt Lake City'],
      },
      'America/Los_Angeles': {
        name: 'Pacific Time',
        code: 'PT',
        country: 'United States',
        cities: ['Los Angeles', 'San Francisco', 'Seattle'],
      },
      'Europe/London': {
        name: 'Greenwich Mean Time',
        code: 'GMT',
        country: 'United Kingdom',
        cities: ['London', 'Edinburgh', 'Dublin'],
      },
      'Europe/Paris': {
        name: 'Central European Time',
        code: 'CET',
        country: 'France',
        cities: ['Paris', 'Madrid', 'Rome'],
      },
      'Europe/Berlin': {
        name: 'Central European Time',
        code: 'CET',
        country: 'Germany',
        cities: ['Berlin', 'Munich', 'Hamburg'],
      },
      'Asia/Tokyo': {
        name: 'Japan Standard Time',
        code: 'JST',
        country: 'Japan',
        cities: ['Tokyo', 'Osaka', 'Kyoto'],
      },
      'Asia/Shanghai': {
        name: 'China Standard Time',
        code: 'CST',
        country: 'China',
        cities: ['Shanghai', 'Beijing', 'Shenzhen'],
      },
      'Asia/Kolkata': {
        name: 'India Standard Time',
        code: 'IST',
        country: 'India',
        cities: ['Mumbai', 'Delhi', 'Bangalore'],
      },
      'Australia/Sydney': {
        name: 'Australian Eastern Time',
        code: 'AET',
        country: 'Australia',
        cities: ['Sydney', 'Melbourne', 'Brisbane'],
      },
      'UTC': {
        name: 'Coordinated Universal Time',
        code: 'UTC',
        country: 'Global',
        cities: ['UTC'],
      },
    };

    this.businessHours = {
      start: '09:00',
      end: '17:00',
    };
  }

  /**
   * Get timezone information
   */
  getTimezoneInfo(timezone) {
    if (!this.timezoneData[timezone]) {
      return null;
    }

    const now = dayjs().tz(timezone);
    const info = this.timezoneData[timezone];

    return {
      ...info,
      timezone,
      currentTime: now.format('YYYY-MM-DD HH:mm:ss'),
      offset: now.format('Z'),
      offsetMinutes: now.utcOffset(),
      isDST: now.isDST(),
    };
  }

  /**
   * Get all supported timezones with current info
   */
  getAllTimezones() {
    return Object.keys(this.timezoneData).map(tz => this.getTimezoneInfo(tz));
  }

  /**
   * Convert time between timezones
   */
  convertTime(time, fromTimezone, toTimezone) {
    const sourceTime = dayjs(time).tz(fromTimezone);
    const targetTime = sourceTime.tz(toTimezone);

    return {
      source: {
        time: sourceTime.format('YYYY-MM-DD HH:mm:ss'),
        timezone: fromTimezone,
        offset: sourceTime.format('Z'),
      },
      target: {
        time: targetTime.format('YYYY-MM-DD HH:mm:ss'),
        timezone: toTimezone,
        offset: targetTime.format('Z'),
      },
      utc: sourceTime.utc().format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  /**
   * Get business hours for a timezone
   */
  getBusinessHours(timezone, date = null) {
    const targetDate = date ? dayjs(date).tz(timezone) : dayjs().tz(timezone);
    
    const start = targetDate
      .hour(parseInt(this.businessHours.start.split(':')[0]))
      .minute(parseInt(this.businessHours.start.split(':')[1]))
      .second(0);
    
    const end = targetDate
      .hour(parseInt(this.businessHours.end.split(':')[0]))
      .minute(parseInt(this.businessHours.end.split(':')[1]))
      .second(0);

    return {
      date: targetDate.format('YYYY-MM-DD'),
      timezone,
      start: start.format('YYYY-MM-DD HH:mm:ss'),
      end: end.format('YYYY-MM-DD HH:mm:ss'),
      startUTC: start.utc().format('YYYY-MM-DD HH:mm:ss'),
      endUTC: end.utc().format('YYYY-MM-DD HH:mm:ss'),
      isWeekend: targetDate.day() === 0 || targetDate.day() === 6,
    };
  }

  /**
   * Check if time is within business hours
   */
  isBusinessHours(time, timezone) {
    const targetTime = dayjs(time).tz(timezone);
    const businessHours = this.getBusinessHours(timezone, targetTime.format('YYYY-MM-DD'));
    
    const businessStart = dayjs(businessHours.start).tz(timezone);
    const businessEnd = dayjs(businessHours.end).tz(timezone);

    return targetTime.isAfter(businessStart) && 
           targetTime.isBefore(businessEnd) && 
           !businessHours.isWeekend;
  }

  /**
   * Get next business hours for scheduling
   */
  getNextBusinessHours(timezone, fromTime = null) {
    const startTime = fromTime ? dayjs(fromTime).tz(timezone) : dayjs().tz(timezone);
    let checkDate = startTime;
    let attempts = 0;
    const maxAttempts = 14; // Check up to 2 weeks ahead

    while (attempts < maxAttempts) {
      const businessHours = this.getBusinessHours(timezone, checkDate.format('YYYY-MM-DD'));
      
      if (!businessHours.isWeekend) {
        const businessStart = dayjs(businessHours.start).tz(timezone);
        const businessEnd = dayjs(businessHours.end).tz(timezone);
        
        if (checkDate.isSame(startTime, 'day')) {
          // Same day - check if we're before business end
          if (startTime.isBefore(businessEnd)) {
            return {
              ...businessHours,
              nextSlot: startTime.isAfter(businessStart) ? 
                       startTime.format('YYYY-MM-DD HH:mm:ss') : 
                       businessStart.format('YYYY-MM-DD HH:mm:ss'),
            };
          }
        } else {
          // Future day - return business start
          return {
            ...businessHours,
            nextSlot: businessStart.format('YYYY-MM-DD HH:mm:ss'),
          };
        }
      }
      
      checkDate = checkDate.add(1, 'day');
      attempts++;
    }

    // Fallback - return next available slot
    const fallback = startTime.add(1, 'hour');
    return {
      date: fallback.format('YYYY-MM-DD'),
      timezone,
      nextSlot: fallback.format('YYYY-MM-DD HH:mm:ss'),
      isWeekend: fallback.day() === 0 || fallback.day() === 6,
      fallback: true,
    };
  }

  /**
   * Get optimal posting times across multiple timezones
   */
  getGlobalOptimalTimes(platforms = ['twitter'], timezones = []) {
    if (timezones.length === 0) {
      timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
    }

    const optimalTimes = {
      twitter: ['09:00', '12:00', '15:00', '18:00'],
      linkedin: ['08:00', '09:00', '12:00', '17:00'],
    };

    const results = [];

    for (const platform of platforms) {
      const platformTimes = optimalTimes[platform] || optimalTimes.twitter;
      
      for (const timezone of timezones) {
        const businessHours = this.getBusinessHours(timezone);
        
        for (const timeStr of platformTimes) {
          const [hour, minute] = timeStr.split(':').map(Number);
          const localTime = dayjs().tz(timezone).hour(hour).minute(minute).second(0);
          
          if (!businessHours.isWeekend) {
            results.push({
              platform,
              timezone,
              localTime: localTime.format('HH:mm'),
              utcTime: localTime.utc().format('HH:mm'),
              timestamp: localTime.format('YYYY-MM-DD HH:mm:ss'),
              utcTimestamp: localTime.utc().format('YYYY-MM-DD HH:mm:ss'),
            });
          }
        }
      }
    }

    // Sort by UTC time for global view
    return results.sort((a, b) => a.utcTimestamp.localeCompare(b.utcTimestamp));
  }

  /**
   * Calculate time until next occurrence
   */
  getTimeUntil(targetTime, timezone = 'UTC') {
    const now = dayjs().tz(timezone);
    const target = dayjs(targetTime).tz(timezone);
    
    const diff = target.diff(now);
    
    if (diff < 0) {
      return {
        isPast: true,
        message: 'Time is in the past',
      };
    }

    const duration = dayjs.duration(diff);
    
    return {
      isPast: false,
      milliseconds: diff,
      days: duration.days(),
      hours: duration.hours(),
      minutes: duration.minutes(),
      seconds: duration.seconds(),
      humanReadable: this.formatDuration(duration),
    };
  }

  /**
   * Format duration in human readable format
   */
  formatDuration(duration) {
    const days = duration.days();
    const hours = duration.hours();
    const minutes = duration.minutes();
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Validate timezone
   */
  isValidTimezone(timezone) {
    try {
      dayjs().tz(timezone);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's likely timezone based on offset
   */
  guessTimezoneFromOffset(offsetMinutes) {
    const matches = [];
    
    for (const [tz, info] of Object.entries(this.timezoneData)) {
      const tzOffset = dayjs().tz(tz).utcOffset();
      if (tzOffset === offsetMinutes) {
        matches.push({ timezone: tz, ...info });
      }
    }
    
    return matches;
  }

  /**
   * Get timezone abbreviation
   */
  getTimezoneAbbreviation(timezone) {
    const info = this.timezoneData[timezone];
    return info ? info.code : timezone;
  }
}