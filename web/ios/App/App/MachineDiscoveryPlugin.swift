import Foundation
import Network
import Capacitor

// Browses the local network for GaggiMates advertising _gaggimate._tcp (see mDNSPlugin.cpp).
@objc(MachineDiscoveryPlugin)
public class MachineDiscoveryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MachineDiscoveryPlugin"
    public let jsName = "MachineDiscovery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var browser: NWBrowser?

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.browser?.cancel()
            let browser = NWBrowser(for: .bonjourWithTXTRecord(type: "_gaggimate._tcp", domain: nil), using: NWParameters())
            browser.browseResultsChangedHandler = { [weak self] _, changes in
                for change in changes {
                    switch change {
                    case .added(let result), .changed(old: _, new: let result, flags: _):
                        if let machine = Self.machine(from: result) { self?.notifyListeners("machineFound", data: machine) }
                    case .removed(let result):
                        if let machine = Self.machine(from: result) { self?.notifyListeners("machineLost", data: machine) }
                    default:
                        break
                    }
                }
            }
            browser.start(queue: .main)
            self.browser = browser
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.browser?.cancel()
            self.browser = nil
            call.resolve()
        }
    }

    // The firmware's instance name is its mDNS hostname, so "<name>.local" reaches it.
    private static func machine(from result: NWBrowser.Result) -> [String: Any]? {
        guard case let .service(name, _, _, _) = result.endpoint else { return nil }
        var version = ""
        if case let .bonjour(txt) = result.metadata { version = txt["version"] ?? "" }
        return ["name": name, "host": "\(name).local", "version": version]
    }
}
