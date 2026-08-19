export default function SubscribeSuccessLoading() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-5 py-20">
      <p className="text-sm text-white/55">Subscription confirmed</p>
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-white">
        You&apos;re in
      </h1>
      <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-white/60">
        Opening your slip.
      </p>
      <div
        aria-hidden
        className="marketing-receipt mt-12 flex min-h-[22rem] w-full max-w-[22rem] flex-col"
      >
        <div className="marketing-receipt-tooth marketing-receipt-tooth-top" />
        <div className="flex-1" />
        <div className="marketing-receipt-tooth marketing-receipt-tooth-bottom" />
      </div>
    </div>
  );
}
