import moment from 'moment/moment'

import { ExchangeService, WebCredentials, Uri, ExchangeVersion, DateTime, AttendeeInfo, AvailabilityData, TimeWindow } from "ews-javascript-api";

import { DateTimeEnum } from './DateTimeEnum'

interface Schedule {
  StartDateTime: string
  EndDateTime: string
}

export class RoomService {

  public username: string
  public password: string
  public rooms: Array<string>
  public datetime: string
  public minutes: number

  private exch: any

  private timeWindow: TimeWindow
  private scheduleWindow: Schedule
  private attendees: Array <AttendeeInfo>

  constructor(username:string, password:string, rooms: Array<string>, datetime: string, minutes: number) {
    this.username = username
    this.password = password
    this.rooms = rooms
    this.datetime = datetime
    this.minutes = minutes

    this
      .makeExchangeService()
      .makeTimeWindow()
      .makeScheduleWindow()
      .makeAttendees()
  }

  private makeExchangeService() {
      this.exch = new ExchangeService(ExchangeVersion.Exchange2013);
      this.exch.Credentials = new WebCredentials(this.username, this.password);
      this.exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');
      return this
  }

  private makeTimeWindow() {
    let start = DateTime.Parse(this.datetime)
    let end = start.AddDays(1)
    this.timeWindow = new TimeWindow(start, end)
    return this
  }

  private makeScheduleWindow() {
    this.scheduleWindow = {
      StartDateTime: this.datetime,
      EndDateTime: moment(this.datetime).add(this.minutes, 'minutes').format(DateTimeEnum.Format)
    }

    return this
  }

  private makeAttendees() {
    this.attendees = this.rooms.map(room => new AttendeeInfo(room));
  }

  async freeRooms(): Promise<Array<string>> {
    let freeRooms: Array<string> = []
    let busySchedules = await this.getBusySchedules().then(busySchedules => {
      return busySchedules
    })

    for (let room of Object.keys(busySchedules)) {

      if (this.hasFreeSchedule(busySchedules[room])) {
        freeRooms.push(room)
      }
    }
    return freeRooms
  }

  private hasFreeSchedule(schedules: Array<Schedule>): boolean {
    for (let schedule of schedules) {
      let hasConflict =
      moment(this.scheduleWindow.StartDateTime)
      .isBetween(schedule.StartDateTime, schedule.EndDateTime, null, '[)')
      ||
      moment(this.scheduleWindow.EndDateTime)
      .isBetween(schedule.StartDateTime, schedule.EndDateTime, null, '(]')

      if  (hasConflict) {
        return false
      }
    }

    return true
  }

  async getBusySchedules() : Promise<any> {
    let busySchedules = new Map<string, Array<Schedule>>()
    try {
      await this.getUserAvailability().then( (availabilityResponse => {
        const responses = availabilityResponse['attendeesAvailability']['responses']
        for (const [i, res] of responses.entries()) {
          busySchedules[this.rooms[i]] = []
          for (const calEvent of res.calendarEvents) {
              const schedule = this.getSchedule(calEvent)
              busySchedules[this.rooms[i]].push(schedule)
          }
        }
      }))
    } catch (error) {
      throw error
    }

    return busySchedules
  }

  private getSchedule(calEvent: any) {
    const startDateTime = calEvent.startTime.getMomentDate().format(DateTimeEnum.Format)
    const endDateTime = calEvent.endTime.getMomentDate().format(DateTimeEnum.Format)
    let schedule: Schedule = {
      StartDateTime: startDateTime,
      EndDateTime: endDateTime
    }
    return schedule
  }

  async getUserAvailability() {
    let availabilityResponse = await this.exch.GetUserAvailability(this.attendees, this.timeWindow, AvailabilityData.FreeBusy)
    return availabilityResponse
  }
}