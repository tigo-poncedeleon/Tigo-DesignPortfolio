// PageTitlePill.swift — REFIT-VERIFIED 2026-07-02 against fresh get_design_context
// on 713:2 (solid) and 713:4 (dashed). Ground truth: white bg, 2px ink border,
// radius 24, 347x70 at x=24 on the 393 canvas, Fugaz One 33 black centered.
// Structure matched the existing implementation — the visible "before" defect was
// the unregistered font only. Border style is SEMANTIC: solid = settled screens,
// dashed = provisional (Choose Ingredients).
// TOKEN vs LITERAL: all values (70/347/24/2/33) are exact token values already.

import SwiftUI

public struct PageTitlePill: View {
    public enum Style {
        /// Settled content (default everywhere).
        case solid
        /// Provisional content — selection/scanning in progress (Choose Ingredients).
        case dashed
    }

    var title: String
    var style: Style
    /// The standard pill is 70pt; My Ingredients (710:1267) uses a compact 49pt one.
    var height: CGFloat

    public init(_ title: String, style: Style = .solid, height: CGFloat = DSSize.titlePillHeight) {
        self.title = title
        self.style = style
        self.height = height
    }

    public var body: some View {
        Text(title)
            .font(DSFont.title)
            .foregroundStyle(DSColor.ink)
            // A title must never lose a letter. Without a line limit the only
            // move SwiftUI has left on an over-long string is the ellipsis —
            // "Today's breakfast" (294.5pt of Fugaz 33) shipped truncated in a
            // 283pt pill on Home. One line + a scale floor degrades to smaller
            // type instead, which still reads; 14pt of inner air also keeps the
            // glyphs off the 24pt corner radius.
            //
            // 0.6, not 0.75. On a 320pt phone (Display Zoom) a band with a back
            // arrow AND a trailing button leaves the pill 104pt of text, and
            // "My shelf" at the old floor still needed 104.6 — so it shipped as
            // "My she…" on the 1.2 tester's iPhone 13.
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(
                RoundedRectangle(cornerRadius: DSRadius.xl)
                    .fill(DSColor.card)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DSRadius.xl)
                    .strokeBorder(
                        DSColor.ink,
                        style: StrokeStyle(
                            lineWidth: DSBorder.standard,
                            dash: style == .dashed ? DSBorder.dashPattern : []
                        )
                    )
            )
            // No outer margin here: the pill is 347 wide in the file, and carrying a
            // 24pt gutter inside the component left it 313 wide once TitleBand added
            // its own 16 — narrow enough that "Choose ingredients!" (322pt of glyphs)
            // truncated. Owning the margin is the caller's job.
            .accessibilityAddTraits(.isHeader)
    }
}

#if !SKIP_PREVIEWS
#Preview {
    VStack(spacing: DSSpacing.xl) {
        PageTitlePill("Scan Receipt")
        PageTitlePill("Choose ingredients!", style: .dashed)
    }
    .padding(.vertical)
    .background(DSColor.butter)
}
#endif
