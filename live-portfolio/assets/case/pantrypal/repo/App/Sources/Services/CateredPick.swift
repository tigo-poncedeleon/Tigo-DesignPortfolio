import Foundation
import os

/// Home's catered dishes: recipes generated FOR the shelf you actually have,
/// remembered against that shelf's fingerprint for the session.
///
/// IN MEMORY ONLY (1.3). There used to be a flat-file record per account so a
/// warm launch could open on last time's dish. The shelf is per session now —
/// every launch wipes it — so a record written for last session's shelf could
/// never be read for this one; the file was dead weight written on every
/// generation and unlinked on every launch. `AppState.beginSession` drops the
/// stores at the session boundary instead.
///
/// PLURAL, and free. The proxy is asked for `ChefBook.cateredSlots` dishes and
/// the store used to rank them and keep only the best, so the same single API
/// call now yields the whole set instead of a fraction of it. Home pins them
/// above the bundled book, so a stocked shelf opens on dinners invented for it
/// rather than one — no extra latency and no extra spend. Numbers are cited
/// from the constant on purpose: this comment has been wrong once already.
///
/// WHY THIS EXISTS. The bundled `ChefBook` ranks its whole book locally and
/// offers the top `ChefBook.deckSize`, which is what lets home open on an
/// answer with no spinner and no API call.
/// But a bundled book cannot cover a real grocery run — a shelf of rigatoni,
/// marinara, chicken thighs and sourdough has no entry in the book, so the
/// honest local top pick is still a dish you're three ingredients short of.
/// This store closes that gap without giving up the instant open: the book
/// paints immediately, and the catered dish arrives afterwards if it arrives
/// at all.
///
/// WHAT IT IS NOT. It is not the shelf's deliberate "Find recipes" batch —
/// that stays `appState.generatedRecipes`, because a dish nobody asked to
/// generate must not turn up in "my recipes". And it never blocks and never
/// reports an error: the card already on screen is a real answer, so a failure
/// here is a non-event.
///
/// IT DOES, HOWEVER, ANNOUNCE ITSELF. This used to say "never spins" too, and
/// the silence was the bug (Tigo, 2026-08-25): a dish that lands with no
/// warning reads as the screen glitching rather than as the reward for a wait.
/// `isGenerating` is what home shows the wait from. The first answer to that
/// report lit a word on the rank badge, which was only a partial one — the card
/// under the badge went on being a bundled dish, so the arrival was still a
/// swap. It now puts `CookingDishCard` in the deck at slot 0 instead: the seat
/// the dish is coming into, which the dish then fills. That is still not a
/// blocking spinner — nothing is gated on it, every control stays live, the
/// bundled top pick is one swipe away, and a failure still passes in silence —
/// it is the difference between an arrival somebody was expecting and one that
/// startles them.
@MainActor
@Observable
final class CateredPickStore {
    /// Bumped whenever an answer lands, so a view can observe "something new
    /// arrived" without observing the dish itself and re-rendering on every
    /// unrelated store change.
    private(set) var latestKey: String?

    /// The shelf currently being catered, if any — home's cue to hold a seat.
    ///
    /// KEYED RATHER THAN A BARE BOOL, because `refresh` cancels the previous
    /// generation when the shelf moves and the two tasks then race: the old
    /// one's cleanup resumes on some later main-actor turn, and a bare
    /// `isGenerating = false` there would pull the card out from under the NEW
    /// generation while it was still running. Clearing is conditional on still
    /// owning the key, so only the live task can end the live state — which
    /// matters more now that a whole card depends on it than it did when it
    /// only drove a word on a badge.
    private(set) var generatingKey: String?

    /// A shelf whose dish has LANDED but not yet been taken by the screen.
    ///
    /// The seat has to outlive the generation by exactly one hand-off: the
    /// task clears `generatingKey` in its `defer` on the same turn `commit`
    /// runs, but `HomeScreen` takes the dish from `.onChange(of: latestKey)`
    /// on a later one. Without this the seat would blink out to reveal the
    /// bundled top pick and then get swapped anyway — the arrival-with-no-
    /// warning bug in miniature. The screen used to paper over that gap by
    /// re-deriving "is there an untaken dish" from its own state on every
    /// body pass, which was both the wrong owner and a full book ranking on
    /// the swipe path. Set only by a real `commit` with dishes in it. Cleared
    /// by `take(for:)`.
    private(set) var readyKey: String?

    /// Whether home should hold a seat at slot 0 for THIS shelf.
    ///
    /// TWO SOURCES, ONE ANSWER: a generation in flight, or a dish that has
    /// landed and not been taken. The in-flight half is deliberately NOT keyed
    /// on the shelf: when the shelf moves, the screen re-renders with the new
    /// names one turn before `.task(id:)` restarts `refresh`, and a keyed test
    /// would drop the seat for that turn and put it back — a blink on every
    /// row of a batch add. `refresh` retires and re-lights the key in a single
    /// synchronous pass, so "something is cooking" is always the truth about
    /// the shelf about to be asked for.
    func holdsSeat(for shelfNames: [String]) -> Bool {
        generatingKey != nil || (readyKey != nil && readyKey == Self.key(shelfNames))
    }

    /// Whether a dish is on its way for THIS shelf.
    ///
    /// Keyed for the same reason `dishes(for:)` is. A generation outlives the
    /// shelf that asked for it — `refresh` returns early for a shelf already
    /// answered, so the previous request is left running rather than cancelled
    /// — and an unkeyed bool would have home promising a dish for a kitchen the
    /// user has since walked away from.
    func isGenerating(for shelfNames: [String]) -> Bool {
        generatingKey == Self.key(shelfNames)
    }

    /// Shelf fingerprint → the dishes generated for it this session, best
    /// first.
    private var answers: [String: [GeneratedRecipe]] = [:]
    /// Fingerprints whose generation already failed. Retrying on every body
    /// pass while Google is having a bad afternoon would burn the user's
    /// prepaid credit for a card that already reads fine.
    private var refused: Set<String> = []
    /// The generation in progress.
    ///
    /// OWNERSHIP IS THE TOKEN, NOT THE KEY. A cancelled task for shelf A that
    /// resumes after a fresh task for shelf A has started must not tear down
    /// its successor's state; key equality cannot tell the two apart, a token
    /// can.
    private var inFlight: (key: String, token: UUID, task: Task<Void, Never>)?

    /// Whose kitchen this store caters. One store per account
    /// (`AppState.catering(for:)`), so a second chef's shelf never answers
    /// the first chef's question.
    private let owner: String

    /// Fired with the dishes this store just committed, so the owner can start
    /// their art before anything asks to draw it.
    ///
    /// WHY IT ISN'T ENOUGH TO LET THE CARD ASK. `HomeScreen` only commits a
    /// catered dish while the user is at rest on slot 0, so somebody three
    /// cards deep when the answer lands never renders the hero — and then eats
    /// the whole cold render the moment they walk back to the top. Starting it
    /// here means the drawing is under way from the instant the recipe exists,
    /// whatever the deck is doing. `IllustrationGenerationGate` coalesces on
    /// the store slug, so the card's own later request joins this one in flight
    /// rather than buying a second copy.
    var onCommitted: (@MainActor ([GeneratedRecipe]) -> Void)?

    /// A shelf smaller than this is not enough to cook from, and asking the
    /// model to invent dinner out of two items produces a dish that needs a
    /// shopping trip — which is the bug, not the fix. (The empty welcome used
    /// to promise this out loud, "Three things is enough."; that line came out
    /// in 1.2.)
    static let minimumShelf = 3

    /// How many catered dishes to keep — the slots the deck reserves at its
    /// front, and exactly what `/api/recipes` is asked for, every time. A
    /// ceiling on what already arrived, never a reason to ask again: raising
    /// it past what one generation returns would silently become a second call.
    static let target = ChefBook.cateredSlots

    /// Long enough to swallow a batch add (a "Still need 4" tap writes four
    /// rows in well under a second, moving the fingerprint four times), short
    /// enough that a single scan feels immediate.
    static let debounce = Duration.milliseconds(700)

    init(owner: String) {
        self.owner = owner
    }

    /// Order- and spelling-insensitive shelf identity: `["Egg", "Tomato"]` and
    /// `["Tomatoes", "Eggs"]` are the same kitchen and must not buy two
    /// generations.
    nonisolated static func key(_ shelfNames: [String]) -> String {
        Set(shelfNames.map(IngredientName.matchKey))
            .filter { !$0.isEmpty }
            .sorted()
            .joined(separator: "|")
    }

    /// The catered dishes for THIS shelf, best first — empty if none.
    ///
    /// Keyed lookup rather than "the last thing we generated": a stale answer
    /// for a shelf the user has since changed would put a dish built from food
    /// they threw out on the front page.
    func dishes(for shelfNames: [String]) -> [GeneratedRecipe] {
        answers[Self.key(shelfNames)] ?? []
    }

    /// The single best catered dish, for callers that only want the headline.
    func dish(for shelfNames: [String]) -> GeneratedRecipe? {
        dishes(for: shelfNames).first
    }

    /// The dishes for this shelf, and the seat released. The screen calls this
    /// at the moment it puts the dish (or decides not to) in front of the user
    /// — `dishes(for:)` is the read that leaves the seat alone.
    func take(for shelfNames: [String]) -> [GeneratedRecipe] {
        let key = Self.key(shelfNames)
        if readyKey == key { readyKey = nil }
        return answers[key] ?? []
    }

    /// Cancels whatever is in flight. Synchronous and complete: `inFlight` and
    /// `generatingKey` are cleared here, not in the cancelled task's `defer`,
    /// which no longer owns them.
    private func retire() {
        guard let previous = inFlight else { return }
        previous.task.cancel()
        inFlight = nil
        generatingKey = nil
    }

    /// Fire-and-forget. Returns as soon as the work is queued, never throws.
    func refresh(shelf: [String], using service: RecipeService) async {
        let key = Self.key(shelf)
        // A MOVED SHELF RETIRES THE OLD GENERATION FIRST, ahead of any guard
        // that might decline the new one. Otherwise a shelf that shrank under
        // three items, or came back to a cached answer, would leave the old
        // task running to completion and landing a dish for a shelf the user
        // has already left.
        if inFlight?.key != key { retire() }
        guard shelf.count >= Self.minimumShelf,
              answers[key] == nil,
              !refused.contains(key),
              inFlight?.key != key
        else { return }

        // SET BEFORE THE TASK, not inside it. The seat should appear on the
        // frame the shelf settles, which means covering the debounce sleep too
        // — a signal that arrives 700ms after the thing it is signalling has
        // already missed the moment it exists for.
        let token = UUID()
        generatingKey = key
        inFlight = (key, token, Task { [weak self] in
            // Only the task that still OWNS the generation may end the lit
            // state or retire the record; a cancelled predecessor resuming
            // later — even one for the same shelf — must not pull the seat
            // from under whoever replaced it. See `inFlight`.
            defer {
                if let self, self.inFlight?.token == token {
                    self.inFlight = nil
                    self.generatingKey = nil
                }
            }
            do {
                try await Task.sleep(for: Self.debounce)
                let raw = try await service.generateRecipes(from: shelf,
                                                            count: Self.target)
                try Task.checkCancellation()
                // Reconcile against the shelf that ASKED, so the coverage chip
                // on the catered card speaks the shelf's own spellings — the
                // same treatment the deliberate path gives its batch.
                let reconciled = ChefBook.reconcile(raw, shelfNames: shelf)
                let chosen = Self.select(reconciled, shelf: shelf)
                // COMMITTED EVEN WHEN EMPTY. An empty commit records "asked,
                // nothing usable came back" — in memory and on disk — which
                // is what stops this shelf being asked for again on the next
                // `.task` run or the next cold open. Nothing lights for it; it
                // just is not asked twice.
                self?.commit(chosen, for: key)
            } catch {
                // A superseded generation owns nothing. Whatever error a
                // cancellation surfaces as — `CancellationError`, URLSession's
                // `.cancelled`, a service's own mapping — this one test covers
                // it, because only `retire()` cancels and it always clears the
                // record first.
                guard let self, self.inFlight?.token == token else { return }
                // Offline, 503, timeout — silence is the design. Remember the
                // refusal so we don't ask again for this exact shelf.
                self.refused.insert(key)
                Self.log("catered: generation failed for a \(shelf.count)-item shelf")
            }
        })
    }

    /// Rank and trim a generation into what home will pin.
    ///
    /// Ranked by the SAME deterministic rule the book is ranked by, so "best"
    /// means one thing in this app — which also front-loads the dishes that
    /// PERFECTLY match the shelf, since coverage sorts descending and a dish
    /// with nothing missing scores 1.0. The prompt already asks for shelf-only
    /// dishes; this is what makes the ones that actually obeyed it lead.
    ///
    /// Deduped on the matching key, not the raw title: a generation that offers
    /// "Fried Rice" and "Fried rice" is offering one dish, and pinning both
    /// would spend a slot saying the same thing twice.
    static func select(_ recipes: [GeneratedRecipe], shelf: [String]) -> [GeneratedRecipe] {
        var seen: Set<String> = []
        return ChefBook.picks(for: shelf, from: recipes)
            .map(\.recipe)
            .filter { seen.insert(ChefBook.normalize($0.title)).inserted }
            .prefix(target)
            .map { $0 }
    }

    private func commit(_ recipes: [GeneratedRecipe], for key: String) {
        answers[key] = recipes
        if !recipes.isEmpty { readyKey = key }
        latestKey = key
        Self.log("catered[\(owner.prefix(8))]: generated \(recipes.map(\.title).joined(separator: ", "))")
        // Last, so the art starts against a store that already holds the dish.
        onCommitted?(recipes)
    }

    private static func log(_ message: String) {
        #if DEBUG
        Logger(subsystem: "com.tigoponcedeleon.pantrypal", category: "catered")
            .debug("\(message, privacy: .public)")
        #endif
    }
}
