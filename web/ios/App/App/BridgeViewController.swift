import UIKit
import WebKit
import Capacitor

// App bridge: registers local plugins and works around the Capacitor 8.5.2 + iOS 27 SDK prompt() load deadlock.
class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MachineDiscoveryPlugin())
    }

    // native-bridge.js blocks on sync prompt() before first paint, which WebKit never delivers.
    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        let cookies = instanceConfiguration.getPluginConfig("CapacitorCookies").getBoolean("enabled", false)
        let http = instanceConfiguration.getPluginConfig("CapacitorHttp").getBoolean("enabled", false)
        // Answers the bridge's config queries in JS so they never reach native prompt(); runs before Capacitor's own scripts.
        let source = """
        (function () {
          var answers = { 'CapacitorCookies.isEnabled': '\(cookies)', 'CapacitorHttp': '\(http)' };
          var nativePrompt = window.prompt;
          window.prompt = function (message, defaultValue) {
            try {
              var type = JSON.parse(message).type;
              if (Object.prototype.hasOwnProperty.call(answers, type)) return answers[type];
            } catch (e) {}
            return nativePrompt.call(window, message, defaultValue);
          };
        })();
        """
        configuration.userContentController.addUserScript(
            WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        return configuration
    }
}
