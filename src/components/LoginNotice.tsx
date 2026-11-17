interface LoginNoticeProps {
  notice: string | null;
}

export function LoginNotice({ notice }: LoginNoticeProps) {
  return (
    <div role="alert" aria-live="polite">
      {notice ? <p className="text-center text-sm font-medium text-destructive">{notice}</p> : null}
    </div>
  );
}
