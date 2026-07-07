import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useLogin } from '../api/hooks'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  async function onSubmit(data: LoginForm) {
    try {
      const result = await loginMutation.mutateAsync(data)
      login(result.user, result.token)
      navigate('/dashboard')
    } catch {
      // error shown via loginMutation.error
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #C9A96E 0, #C9A96E 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 mb-4">
            <span className="text-2xl">✈️</span>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">DepartTravel</h1>
          <p className="text-text/40 text-sm mt-1 tracking-widest uppercase">ERP Agence de Voyage</p>
        </div>

        {/* Form card */}
        <div className="bg-bg2 border border-border rounded-xl p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-text/60 uppercase tracking-wide mb-5">
            Connexion
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Adresse email"
              type="email"
              placeholder="agent@departtravel.tn"
              error={errors.email?.message}
              {...register('email', { required: "L'email est requis" })}
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password', { required: 'Le mot de passe est requis' })}
            />

            {loginMutation.isError && (
              <div className="bg-alert/10 border border-alert/30 rounded-md px-3 py-2 text-sm text-alert">
                Email ou mot de passe incorrect.
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loginMutation.isPending}
              className="w-full justify-center mt-1"
            >
              Se connecter
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text/25 mt-6">
          © {new Date().getFullYear()} DepartTravel · Tous droits réservés
        </p>
      </div>
    </div>
  )
}
