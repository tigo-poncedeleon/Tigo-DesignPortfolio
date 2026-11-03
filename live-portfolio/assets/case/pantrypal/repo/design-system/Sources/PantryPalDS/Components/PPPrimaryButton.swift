// PPPrimaryButton.swift — REFIT-VERIFIED 2026-07-02 against fresh get_design_context
// on 710:1653/1654. Ground truth: bg #FF3939, 2px solid ink border, radius 10,
// 258x42, Fugaz One 20 white label (NO text stroke — absent from the stroke table).
// TOKEN vs LITERAL:
//   - bg #FF3939 → DSColor.brandRed #FF4B4B (user-approved merge, re-confirmed)
//   - height 42 → 44 control token (deliberate accessibility floor — do not revert)
//   - radius 10, border 2, label 20: exact token values
//
// STATES — only `default` is observed in Figma. Pressed and disabled are INFERRED
// from the design language (see docs/principles.md "Inferred states"):
//   pressed:  sticker pushes down 2pt + darkens 10% (ink-outline system has no shadows)
//   disabled: steel surface + placeholder-gray text, outline kept (settled-but-inert)

import SwiftUI

public struct PPPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(DSFont.button)
            .foregroundStyle(isEnabled ? DSColor.inverse : DSColor.State.disabledText)
            .frame(maxWidth: .infinity)
            .frame(height: DSSize.controlHeight)
            .background(
                RoundedRectangle(cornerRadius: DSRadius.sm)
                    .fill(isEnabled ? DSColor.brandRed : DSColor.State.disabledSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DSRadius.sm)
                    .strokeBorder(DSColor.ink, lineWidth: DSBorder.standard)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DSRadius.sm)
                    .fill(configuration.isPressed ? DSColor.State.pressedOverlay : .clear)
            )
            .offset(y: configuration.isPressed ? DSShadow.pressedOffset : 0)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

public extension ButtonStyle where Self == PPPrimaryButtonStyle {
    /// PantryPal primary button: `Button("Log In") {}.buttonStyle(.ppPrimary)`
    static var ppPrimary: PPPrimaryButtonStyle { PPPrimaryButtonStyle() }
}

#if !SKIP_PREVIEWS
#Preview {
    VStack(spacing: DSSpacing.md) {
        Button("Log In") {}.buttonStyle(.ppPrimary)
        Button("Log In") {}.buttonStyle(.ppPrimary).disabled(true)
    }
    .padding(DSSpacing.xl)
}
#endif
