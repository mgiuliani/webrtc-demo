using Microsoft.AspNet.SignalR;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace WebRtcDemo.Hubs
{
    public class WebRtcHub : Hub
    {
        public void Send(string message)
        {
            Clients.Others.newMessage(message);
        }
    }
}