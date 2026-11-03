// PPStickerButton.swift — the two NON-primary members of the button family.
//
// Same sticker as `PPPrimaryButtonStyle` — white card, 2pt ink edge, radius 10,
// 44pt control height — differing only in what the label means:
//   secondary:   ink label. "Next dish", "Type my groceries", "Add more groceries".
//   destructive: brand-red label. Sign out, Delete my account, Clear the shelf.
//
// Both carry the family's INFERRED pressed state (push down 2pt, darken 10%;
// see docs/principles.md), which is the reason these exist as styles at all:
// the app had hand-rolled this surface at five call sites under
// `.buttonStyle(.plain)`, so the app's most-tapped secondary controls were the
// only buttons in it that did not answer a finger.

import SwiftUI

/// The neutral full-width sticker. Pairs under a `.ppPrimary` as the quieter
/// of two ways forward.
public struct PPSecondaryStickerStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DSFont.label)
            .foregroundStyle(DSColor.ink)
            .sticker(pressed: configuration.isPressed)
    }
}

/// The full-width sticker in the destructive colourway — white fill so it never
/// competes with a real primary action, brand-red label and the standard ink
/// edge so it is unmistakably a button.
public struct PPDestructiveStickerStyle: ButtonStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DSFont.button)
            // The error token: destructive label text on a white sticker,
            // which brand red does not clear for contrast.
            .foregroundStyle(DSColor.State.error)
            .sticker(pressed: configuration.isPressed)
    }
}

public extension ButtonStyle where Self == PPSecondaryStickerStyle {
    /// `Button("Next dish") {}.buttonStyle(.ppSecondary)`
    static var ppSecondary: PPSecondaryStickerStyle { PPSecondaryStickerStyle() }
}

public extension ButtonStyle where Self == PPDestructiveStickerStyle {
    /// `Button("Sign out") {}.buttonStyle(.ppDestructiveSticker)`
    static var ppDestructiveSticker: PPDestructiveStickerStyle { PPDestructiveStickerStyle() }
}

private extension View {
    /// The shell both styles share: everything except what the label says.
    func sticker(pressed: Bool) -> some View {
        self
            .frame(maxWidth: .infinity)
            .frame(height: DSSize.controlHeight)
            .background(RoundedRectangle(cornerRadius: DSRadius.sm).fill(DSColor.card))
            .overlay(
                RoundedRectangle(cornerRadius: DSRadius.sm)
                    .strokeBorder(DSColor.ink, lineWidth: DSBorder.standard)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DSRadius.sm)
                    .fill(pressed ? DSColor.State.pressedOverlay : .clear)
            )
            .offset(y: pressed ? DSShadow.pressedOffset : 0)
            .animation(.easeOut(duration: 0.08), value: pressed)
    }
}

#if !SKIP_PREVIEWS
#Preview {
    VStack(spacing: DSSpacing.md) {
        Button("Start cooking") {}.buttonStyle(.ppPrimary)
        Button("Next dish") {}.buttonStyle(.ppSecondary)
        Button("Sign out") {}.buttonStyle(.ppDestructiveSticker)
    }
    .padding(DSSpacing.xl)
}
#endif
