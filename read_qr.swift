import Foundation
import CoreImage
import AppKit
import PDFKit

func readQR(from image: NSImage) -> [String] {
    guard let tiffData = image.tiffRepresentation,
          let ciImage = CIImage(data: tiffData) else {
        return []
    }
    
    let context = CIContext()
    let options = [CIDetectorAccuracy: CIDetectorAccuracyHigh]
    guard let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: context, options: options) else {
        return []
    }
    
    let features = detector.features(in: ciImage)
    var results: [String] = []
    
    for feature in features {
        if let qrFeature = feature as? CIQRCodeFeature, let message = qrFeature.messageString {
            results.append(message)
        }
    }
    return results
}

func readQRsFromPDF(url: URL) -> [String] {
    guard let pdfDocument = PDFDocument(url: url) else { return [] }
    var results: [String] = []
    
    for i in 0..<pdfDocument.pageCount {
        guard let page = pdfDocument.page(at: i) else { continue }
        
        let pageRect = page.bounds(for: .mediaBox)
        let image = NSImage(size: pageRect.size)
        
        image.lockFocus()
        if let context = NSGraphicsContext.current?.cgContext {
            page.draw(with: .mediaBox, to: context)
        }
        image.unlockFocus()
        
        results.append(contentsOf: readQR(from: image))
    }
    return results
}

func readQRsFromFile(path: String) -> [String] {
    let url = URL(fileURLWithPath: path)
    if path.lowercased().hasSuffix(".pdf") {
        return readQRsFromPDF(url: url)
    } else {
        guard let image = NSImage(contentsOf: url) else { return [] }
        return readQR(from: image)
    }
}

let directory = "/Users/hemiolia/Desktop/FACTURES VERIFACTU"
let fileManager = FileManager.default

do {
    let files = try fileManager.contentsOfDirectory(atPath: directory)
    for file in files {
        if file.hasPrefix(".") { continue }
        let fullPath = (directory as NSString).appendingPathComponent(file)
        print("File: \(file)")
        let qrs = readQRsFromFile(path: fullPath)
        for qr in qrs {
            print("  QR: \(qr)")
        }
    }
} catch {
    print("Error: \(error)")
}
