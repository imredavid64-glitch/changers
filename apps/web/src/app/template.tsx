// v3: every navigation re-mounts this template, so the four strand stripes sweep up off each new page
// (the animated version only; without it, or with reduced motion, the wipe is display: none).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="wipe" aria-hidden="true">
        <i className="fill-nature" /><i className="fill-economy" /><i className="fill-society" /><i className="fill-wellbeing" />
      </div>
      {children}
    </>
  )
}
