import UIKit
import WebKit
import PhotosUI
import Vision

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.overrideUserInterfaceStyle = .light
        window.rootViewController = CalmViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class CalmViewController: UIViewController, WKScriptMessageHandler, PHPickerViewControllerDelegate, WKNavigationDelegate {
    private var web: WKWebView!
    private var importImage: CGImage?
    private let tapFeedback = UIImpactFeedbackGenerator(style: .light)
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "feedback")
        configuration.userContentController.add(self, name: "timetable")
        configuration.userContentController.add(self, name: "courseNames")
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.backgroundColor = .white
        view = web
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") else {
            web.loadHTMLString("<p>앱 리소스를 찾을 수 없습니다.</p>", baseURL: nil)
            return
        }
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(navigationAction.request.url?.isFileURL == true ? .allow : .cancel)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true else { return }
        if message.name == "feedback" { tapFeedback.impactOccurred(); return }
        if message.name == "courseNames" {
            if let payload = message.body as? [String: Any], let token = payload["token"] as? String,
               let regions = payload["regions"] as? [[Double]], regions.count <= 336,
               let image = importImage {
                readTitles(image, token: token, regions: regions)
            }
            return
        }
        guard message.name == "timetable", presentedViewController == nil else { return }
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        present(picker, animated: true)
    }
    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let provider = results.first?.itemProvider else { return }
        guard provider.canLoadObject(ofClass: UIImage.self) else { reportFailure(); return }
        provider.loadObject(ofClass: UIImage.self) { [weak self] item, _ in
            guard let image = item as? UIImage else { self?.reportFailure(); return }
            self?.recognize(image)
        }
    }
    private func reportFailure() {
        DispatchQueue.main.async { [weak self] in
            self?.web.evaluateJavaScript("window.importFailure('사진을 읽을 수 없어. 다른 캡처를 선택해줘.')")
        }
    }
    private func recognize(_ image: UIImage) {
        let ratio = min(1, 2200 / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1,image.size.width * ratio), height: max(1,image.size.height * ratio))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let normalized = UIGraphicsImageRenderer(size: size, format: format).image { renderer in
            UIColor.white.setFill()
            renderer.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let cg = normalized.cgImage, let data = normalized.jpegData(compressionQuality: 0.9) else { reportFailure(); return }
        let words = textLines(in: cg)
        let source = "data:image/jpeg;base64," + data.base64EncodedString()
        DispatchQueue.main.async { [weak self] in
            self?.importImage = cg
            self?.web.callAsyncJavaScript("window.receiveTimetable(src, words)", arguments: ["src": source, "words": words], in: nil, in: .page, completionHandler: nil)
        }
    }
    private func textLines(in cg: CGImage) -> [[String: Any]] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["ko-KR", "en-US"]
        request.usesLanguageCorrection = false
        try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
        return (request.results ?? []).compactMap { observation in
            guard let text = observation.topCandidates(1).first?.string else { return nil }
            return ["text": text, "x": observation.boundingBox.midX, "y": 1-observation.boundingBox.midY, "h": observation.boundingBox.height]
        }
    }
    private func readTitles(_ image: CGImage, token: String, regions: [[Double]]) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let size = CGRect(x: 0, y: 0, width: image.width, height: image.height)
            let groups: [[[String: Any]]] = regions.map { point in
                guard point.count == 4, point.allSatisfy({ $0.isFinite && (0...1).contains($0) }),
                      point[2] > point[0], point[3] > point[1] else { return [] }
                let rect = CGRect(x: point[0]*size.width, y: point[1]*size.height,
                                  width: (point[2]-point[0])*size.width, height: (point[3]-point[1])*size.height)
                guard let crop = image.cropping(to: rect.integral.intersection(size)) else { return [] }
                return autoreleasepool { self.textLines(in: crop) }
            }
            DispatchQueue.main.async {
                self.web.callAsyncJavaScript("window.receiveCourseNames(token, groups)", arguments: ["token": token, "groups": groups], in: nil, in: .page, completionHandler: nil)
            }
        }
    }
}
