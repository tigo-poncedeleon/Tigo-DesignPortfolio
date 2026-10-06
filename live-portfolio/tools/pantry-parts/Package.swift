// swift-tools-version: 5.9
// pantry-parts — draws the Build chapter's picture on PantryPal's story map
// (assets/case/pantrypal/story/build.webp) with the app's own design system,
// so the parts in it are PantryPalDS's own components, not drawings of them.
// Run by tools/pantry-story.sh. PANTRYPAL names the app's repository
// (by default ~/Developer/PantryPal, beside this one).
import Foundation
import PackageDescription

let app = ProcessInfo.processInfo.environment["PANTRYPAL"] ?? "../../../../PantryPal"

let package = Package(
    name: "pantry-parts",
    platforms: [.macOS(.v14)],
    dependencies: [.package(path: "\(app)/design-system")],
    targets: [
        .executableTarget(
            name: "pantry-parts",
            dependencies: [.product(name: "PantryPalDS", package: "design-system")],
            path: "Sources/pantry-parts"
        ),
    ]
)
