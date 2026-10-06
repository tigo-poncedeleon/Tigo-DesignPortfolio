// pantry-parts <out.png> <illustrations-dir>
//
// The parts the app is built from, laid out on the tile as they come off
// the design system: the shelf's card for the tuna (three of them, picked),
// on the shelf's butter; the shelf's green plus; home's title band; and the
// primary button. Drawn at the story map's tile shape, 400 by 320 points,
// at three times, on nothing: the tile's own light shows through.
import AppKit
import PantryPalDS
import SwiftUI

let args = CommandLine.arguments
guard args.count == 3 else {
    print("usage: pantry-parts <out.png> <illustrations-dir>")
    exit(64)
}
let output = URL(fileURLWithPath: args[1])
let drawings = args[2]

func drawing(_ name: String) -> Image {
    guard let image = NSImage(contentsOfFile: "\(drawings)/\(name).png") else {
        print("no drawing \(name).png in \(drawings)")
        exit(66)
    }
    return Image(nsImage: image)
}

/// The shelf's butter under a card, ringed in the app's ink as its cards are.
struct Plate<Content: View>: View {
    var content: Content
    init(@ViewBuilder _ content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(DSColor.butter))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(DSColor.ink, lineWidth: 2))
    }
}

struct Parts: View {
    var body: some View {
        ZStack {
            Plate {
                IngredientCard(name: "Tuna", quantity: 3, isSelected: true) {
                    drawing("tuna").resizable().scaledToFit()
                }
                .frame(width: 112)
            }
            .rotationEffect(.degrees(-6))
            .shadow(color: .black.opacity(0.16), radius: 9, x: 0, y: 8)
            .position(x: 114, y: 178)

            PageTitlePill("Dinner!")
                .frame(width: 176)
                .rotationEffect(.degrees(3))
                .shadow(color: .black.opacity(0.14), radius: 7, x: 0, y: 6)
                .position(x: 280, y: 104)

            Button("Start cooking") {}.buttonStyle(.ppPrimary)
                .frame(width: 184)
                .rotationEffect(.degrees(-2))
                .shadow(color: .black.opacity(0.16), radius: 8, x: 0, y: 7)
                .position(x: 284, y: 214)

            CheckBadge(size: 46, glyph: .plus)
                .rotationEffect(.degrees(10))
                .shadow(color: .black.opacity(0.16), radius: 5, x: 0, y: 4)
                .position(x: 190, y: 112)
        }
        .frame(width: 400, height: 320)
        .environment(\.colorScheme, .light)
        .environment(\.dsStaticRender, true)
    }
}

@MainActor func render() {
    let renderer = ImageRenderer(content: Parts())
    renderer.scale = 3
    renderer.proposedSize = ProposedViewSize(width: 400, height: 320)
    guard let image = renderer.cgImage,
          let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])
    else {
        print("pantry-parts: the renderer returned nothing")
        exit(1)
    }
    do { try png.write(to: output) } catch {
        print("pantry-parts: \(error.localizedDescription)")
        exit(1)
    }
    print("pantry-parts: \(image.width) x \(image.height)")
    exit(0)
}

Task { @MainActor in render() }
RunLoop.main.run()
