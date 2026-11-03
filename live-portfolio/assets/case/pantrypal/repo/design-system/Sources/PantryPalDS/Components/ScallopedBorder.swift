// ScallopedBorder.swift — REFIT 2026-07-29 against the border-decoration node
// (710:1596) rendered IN ISOLATION, which is what finally settled its structure.
//
// The edge is two staggered rows of outlined 24x16.06 ellipses on a 24pt pitch,
// and the rows have DIFFERENT FILLS:
//   lower row (y 8.5, x-phase  5) — brand red, drawn first
//   upper row (y 0,   x-phase -7) — SKY, drawn on top, carving the red row into
//                                   the scallop "fans"
// Neighbours within a row are exactly tangent (pitch == bump width), so the sky
// row leaves a narrow gap at each tangent point; the red behind shows through it
// as the small pointed tip that breaks the edge's line. That tip is the detail
// every previous fit missed, and it is why the edge cannot be drawn as a single
// row: with one row you get whole floating ellipses, and with both rows in one
// fill you get a solid wave.
//
// Verified against per-pixel probes of the Login frame:
//   (17,214) black — two sky ellipses' outlines meeting at their tangent point
//   (17,217) red   — the gap above that tangent point, red row showing through
//   (5,220)  sky   — inside a sky-filled upper ellipse, 6pt BELOW the sky rect's
//                    own bottom edge at 214
//
// TOKEN vs LITERAL: bump width 24 = DSBorder.Scallop.bumpWidth (exact); bump
// height 16.06, row offset 8.5 and the x-phases are literal measurements.

import SwiftUI

public struct ScallopedBorder: View {
    /// Which scallop the file draws. Both are ellipse rows on a 24pt pitch.
    public enum Style {
        /// Two-row outlined edge under every header (710:1596).
        case header
        /// Single unoutlined row hanging off the bottom of the "Let's get cooking!"
        /// band (Login 710:1570 "border-decoration-bottom": 24x26.29, x-phase -6).
        case fringe

        var pitch: CGFloat { 24 }

        var bump: CGSize {
            switch self {
            case .header: return CGSize(width: DSBorder.Scallop.bumpWidth, height: 16.06)
            case .fringe: return CGSize(width: 24, height: 26.29)
            }
        }

        /// Ink outline on each bump. The fringe's butter bumps are unstroked.
        var strokeWidth: CGFloat {
            switch self {
            case .header: return DSBorder.hairline
            case .fringe: return 0
            }
        }

        public var height: CGFloat {
            switch self {
            case .header: return 8.5 + 16.06
            case .fringe: return 26.29
            }
        }
    }

    var color: Color
    var maskColor: Color
    var style: Style

    /// - Parameters:
    ///   - color: the scallop's own fill (brand red for headers).
    ///   - maskColor: fill for the upper row, which must match whatever sits above
    ///     the edge so the two read as one surface — the sky band, normally.
    ///   - style: `.header` (two rows, outlined) or `.fringe` (one row, plain).
    public init(color: Color = DSColor.brandRed,
                maskColor: Color = DSColor.sky,
                style: Style = .header) {
        self.color = color
        self.maskColor = maskColor
        self.style = style
    }

    /// Height of the default `.header` style, kept for existing call sites.
    public static let height: CGFloat = Style.header.height

    /// (x of the first bump's left edge, row y, fill), back to front. Phases are
    /// one pitch left of the file's first bump so each row runs off the leading
    /// edge as it does there.
    private var rows: [(phase: CGFloat, y: CGFloat, fill: Color)] {
        switch style {
        case .header: return [(5 - 24, 8.5, color), (-7 - 24, 0, maskColor)]
        case .fringe: return [(-6, 0, color)]
        }
    }

    public var body: some View {
        Canvas { context, size in
            for row in rows {
                var x = row.phase
                while x < size.width {
                    let rect = CGRect(x: x, y: row.y,
                                      width: style.bump.width, height: style.bump.height)
                    let path = Ellipse().path(in: rect)
                    // Fill then stroke per bump, in order — the same way the file
                    // stacks its ellipse nodes, so a neighbour's fill trims the
                    // previous stroke down to the cusp that should remain visible.
                    context.fill(path, with: .color(row.fill))
                    if style.strokeWidth > 0 {
                        context.stroke(path, with: .color(DSColor.ink),
                                       lineWidth: style.strokeWidth)
                    }
                    x += style.pitch
                }
            }
        }
        .frame(height: style.height)
        .clipped()
        .accessibilityHidden(true)
    }
}
#if !SKIP_PREVIEWS
#Preview {
    VStack(spacing: 0) {
        Rectangle().fill(DSColor.sky).frame(height: 60)
        ScallopedBorder().offset(y: -8.5)
        Spacer()
    }
}
#endif
