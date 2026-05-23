using System;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SIPSorcery.Net;

namespace Resala.Backend.Services
{
    public class StunHostedService : IHostedService
    {
        private readonly ILogger<StunHostedService> _logger;
        private readonly IConfiguration _configuration;
        private STUNListener? _primaryListener;
        private STUNListener? _secondaryListener;
        private STUNServer? _stunServer;
        private bool _enabled;
        private int _primaryPort;
        private int _secondaryPort;
        private string _ipAddressStr;

        public StunHostedService(ILogger<StunHostedService> logger, IConfiguration configuration)
        {
            _logger = logger;
            _configuration = configuration;

            // Load settings
            var section = _configuration.GetSection("StunSettings");
            _enabled = section.GetValue<bool>("Enabled", true);
            _primaryPort = section.GetValue<int>("Port", 3478);
            _secondaryPort = section.GetValue<int>("SecondaryPort", _primaryPort + 1);
            _ipAddressStr = section.GetValue<string>("IpAddress", "0.0.0.0");
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            if (!_enabled)
            {
                _logger.LogInformation("STUN Server is disabled in configuration.");
                return Task.CompletedTask;
            }

            try
            {
                if (!IPAddress.TryParse(_ipAddressStr, out var ipAddress))
                {
                    _logger.LogWarning($"Invalid STUN IPAddress: '{_ipAddressStr}'. Defaulting to IPAddress.Any.");
                    ipAddress = IPAddress.Any;
                }

                var primaryEndPoint = new IPEndPoint(ipAddress, _primaryPort);
                var secondaryEndPoint = new IPEndPoint(ipAddress, _secondaryPort);

                _logger.LogInformation($"Starting SIPSorcery STUN Server on {primaryEndPoint} (Primary) and {secondaryEndPoint} (Secondary)...");

                _primaryListener = new STUNListener(primaryEndPoint);
                _secondaryListener = new STUNListener(secondaryEndPoint);

                _stunServer = new STUNServer(
                    primaryEndPoint,
                    _primaryListener.Send,
                    secondaryEndPoint,
                    _secondaryListener.Send
                );

                _primaryListener.MessageReceived += _stunServer.STUNPrimaryReceived;
                _secondaryListener.MessageReceived += _stunServer.STUNSecondaryReceived;

                _logger.LogInformation("SIPSorcery STUN Server successfully started and listening.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start SIPSorcery STUN Server.");
            }

            return Task.CompletedTask;
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Stopping STUN Server...");

            try
            {
                if (_primaryListener != null)
                {
                    if (_stunServer != null)
                    {
                        _primaryListener.MessageReceived -= _stunServer.STUNPrimaryReceived;
                    }
                    _primaryListener.Close();
                }

                if (_secondaryListener != null)
                {
                    if (_stunServer != null)
                    {
                        _secondaryListener.MessageReceived -= _stunServer.STUNSecondaryReceived;
                    }
                    _secondaryListener.Close();
                }

                _logger.LogInformation("STUN Server stopped successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while stopping STUN Server.");
            }

            return Task.CompletedTask;
        }
    }
}
