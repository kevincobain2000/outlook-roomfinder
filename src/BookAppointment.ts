import { Appointment, DateTime, ExchangeService, WebCredentials, ExchangeVersion, Uri, SendInvitationsMode } from "ews-javascript-api";

export async function BookAppointment (username: string, password: string, subject: string, room: string, datetime: string, minutes: number): Promise<boolean> {
  let exch = new ExchangeService(ExchangeVersion.Exchange2013);
  exch.Credentials = new WebCredentials(username, password);
  exch.Url = new Uri('https://outlook.office365.com/Ews/Exchange.asmx');

  let appointment = new Appointment(exch);

  appointment.Subject = subject
  appointment.Start = DateTime.Parse(datetime);

  appointment.End = appointment.Start.Add(minutes, 'minutes');

  appointment.RequiredAttendees.Add(room);
  await appointment.Save(SendInvitationsMode.SendToAllAndSaveCopy).then( function() {
  }, function(ei) {
      console.log(ei);
  });
  return true
}
