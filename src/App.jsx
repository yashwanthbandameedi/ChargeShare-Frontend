import { useEffect, useState } from 'react'
import './App.css'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')

const API_URL = `${API_BASE_URL}/api/chargers`
const AUTH_URL = `${API_BASE_URL}/api/auth`
const CUSTOMER_AUTH_URL = `${API_BASE_URL}/api/customer-auth`


const initialHostForm = {
  name: '',
  city: '',
  address: '',
  vehicleType: 'car',
  pricePerHour: '',
}

function App() {
  const [vehicle, setVehicle] = useState('car')
  const [location, setLocation] = useState('')
  const [chargers, setChargers] = useState([])
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [showHostForm, setShowHostForm] = useState(false)
  const [showHostDashboard, setShowHostDashboard] = useState(false)
  const [hostChargers, setHostChargers] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [qrFiles, setQrFiles] = useState({})
  const [qrUploadBusyId, setQrUploadBusyId] = useState(null)
  const [qrUploadMessages, setQrUploadMessages] = useState({})

  const [hostForm, setHostForm] = useState(initialHostForm)
  const [hostLoading, setHostLoading] = useState(false)
  const [hostMessage, setHostMessage] = useState('')
  const [hostError, setHostError] = useState('')

  const [showAuthForm, setShowAuthForm] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authRole, setAuthRole] = useState('host')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })

  const [hostAccount, setHostAccount] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('chargeshareHost') || 'null'
      )
    } catch {
      return null
    }
  })

  const [customerAccount, setCustomerAccount] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('chargeshareCustomer') || 'null'
      )
    } catch {
      return null
    }
  })

  const [selectedCharger, setSelectedCharger] = useState(null)
  const [bookingDate, setBookingDate] = useState(() => { const d = new Date(Date.now() + 3600000); d.setMinutes(0,0,0); return d.toISOString().slice(0,10) })
  const [bookingTime, setBookingTime] = useState('10:00')
  const [bookingDuration, setBookingDuration] = useState('1')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [bookingMessage, setBookingMessage] = useState('')
  const [calendarView, setCalendarView] = useState('week')
  const [calendarBookings, setCalendarBookings] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [customerBookings, setCustomerBookings] = useState([])
  const [reviewForms, setReviewForms] = useState({})
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null)
  const [reviewMessages, setReviewMessages] = useState({})
  const [reviewedBookingIds, setReviewedBookingIds] = useState([])
  const [hostBookings, setHostBookings] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [earningsLoading, setEarningsLoading] = useState(false)
  const [earningsError, setEarningsError] = useState('')
  const [hostBookingActionId, setHostBookingActionId] = useState(null)
  const [bookingHistoryLoading, setBookingHistoryLoading] = useState(false)
  const [bookingHistoryError, setBookingHistoryError] = useState('')
  const [showCustomerBookings, setShowCustomerBookings] = useState(false)

  const signedInAccount = hostAccount || customerAccount

  const localDateString = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const dateAtLocalTime = (dateString, timeString) =>
    new Date(`${dateString}T${timeString}:00`)

  const calendarRange = (dateString, view) => {
    const selected = dateAtLocalTime(dateString, '00:00')
    const start = new Date(selected)
    if (view === 'week') {
      const day = (start.getDay() + 6) % 7
      start.setDate(start.getDate() - day)
    }
    const end = new Date(start)
    end.setDate(end.getDate() + (view === 'week' ? 7 : 1))
    return { start, end }
  }

  useEffect(() => {
    if (!selectedCharger?.id || !bookingDate) return
    const { start, end } = calendarRange(bookingDate, calendarView)
    const params = new URLSearchParams({
      start: `${localDateString(start)}T00:00:00`,
      end: `${localDateString(end)}T00:00:00`,
    })
    let cancelled = false
    setCalendarLoading(true)
    setCalendarError('')
    fetch(`${API_BASE_URL}/api/bookings/charger/${selectedCharger.id}/availability?${params}`, { headers: { Authorization: `Bearer ${customerAccount?.token || ''}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Availability could not be loaded (${response.status}).`)
        return data
      })
      .then((data) => {
        if (!cancelled) setCalendarBookings(Array.isArray(data) ? data : [])
      })
      .catch((error) => {
        if (!cancelled) {
          setCalendarBookings([])
          setCalendarError(error.message || 'Availability could not be loaded.')
        }
      })
      .finally(() => { if (!cancelled) setCalendarLoading(false) })
    return () => { cancelled = true }
  }, [selectedCharger?.id, bookingDate, calendarView])

  const slotIsBusy = (dateString, timeString, durationHours = Number(bookingDuration || 1)) => {
    const slotStart = dateAtLocalTime(dateString, timeString)
    const slotEnd = new Date(slotStart.getTime() + durationHours * 60 * 60 * 1000)
    return calendarBookings.some((booking) => {
      const busyStart = new Date(booking.startTime)
      const busyEnd = new Date(booking.endTime)
      return slotStart < busyEnd && slotEnd > busyStart
    })
  }

  const selectCalendarSlot = (dateString, timeString) => {
    setBookingDate(dateString)
    setBookingTime(timeString)
    setBookingError('')
  }


  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  // --------------------------------------------------
  // CHARGER SEARCH
  // --------------------------------------------------

  const handleSearch = async (event) => {
    event.preventDefault()

    if (!location.trim()) {
      setSearchError('Please enter a city or area.')
      setSearchSubmitted(true)
      return
    }

    const parts = location.trim().split(',')
    const city = parts[parts.length - 1].trim()

    setLoading(true)
    setSearchError('')
    setChargers([])
    setSearchSubmitted(true)

    try {
      const params = new URLSearchParams({
        city,
        vehicleType: vehicle,
      })

      const response = await fetch(
        `${API_URL}?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const chargerResults = await response.json()
      const rankedChargers = await Promise.all(
        (Array.isArray(chargerResults) ? chargerResults : []).map(async (charger) => {
          try {
            const reviewResponse = await fetch(`${API_BASE_URL}/api/reviews/charger/${charger.id}`)
            if (!reviewResponse.ok) return { ...charger, averageChargerRating: null, reviewCount: 0 }
            const reviewData = await reviewResponse.json()
            const reviews = Array.isArray(reviewData.reviews) ? reviewData.reviews : []
            const rating = Number(reviewData.averageChargerRating)
            return {
              ...charger,
              averageChargerRating: Number.isFinite(rating) && reviews.length > 0 ? rating : null,
              reviewCount: reviews.length,
            }
          } catch (reviewError) {
            console.warn(`Could not load reviews for charger ${charger.id}:`, reviewError)
            return { ...charger, averageChargerRating: null, reviewCount: 0 }
          }
        })
      )
      rankedChargers.sort((a, b) => {
        const ratingA = a.averageChargerRating
        const ratingB = b.averageChargerRating
        const tier = (rating, count) => {
          if (!count || rating == null) return 0
          if (rating >= 4.5) return 3
          if (rating >= 3.5) return 2
          return 1
        }
        const tierDifference = tier(ratingB, b.reviewCount) - tier(ratingA, a.reviewCount)
        if (tierDifference !== 0) return tierDifference
        if (ratingA != null && ratingB != null && ratingA !== ratingB) return ratingB - ratingA
        if (a.reviewCount !== b.reviewCount) return b.reviewCount - a.reviewCount
        return String(a.name || '').localeCompare(String(b.name || ''))
      })
      setChargers(rankedChargers)
    } catch (error) {
      console.error('Charger search failed:', error)

      setSearchError(
        'Could not load chargers. Check that your backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // OPEN AUTHENTICATION
  // --------------------------------------------------

  const openAuth = (mode = 'login', role = 'host') => {
    setAuthMode(mode)
    setAuthRole(role)
    setAuthError('')
    setAuthMessage('')
    setAuthForm({
      fullName: '',
      email: '',
      password: '',
    })
    setShowAuthForm(true)

    window.setTimeout(() => scrollTo('host-auth'), 100)
  }

  const handleAuthChange = (event) => {
    const { name, value } = event.target

    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setAuthError('')
    setAuthMessage('')
  }

  // --------------------------------------------------
  // CUSTOMER AND HOST SIGNUP / LOGIN
  // --------------------------------------------------

  const handleAuthSubmit = async (event) => {
    event.preventDefault()

    setAuthLoading(true)
    setAuthError('')
    setAuthMessage('')

    try {
      const payload =
        authMode === 'signup'
          ? {
              fullName: authForm.fullName.trim(),
              email: authForm.email.trim(),
              password: authForm.password,
            }
          : {
              email: authForm.email.trim(),
              password: authForm.password,
            }

      const baseUrl =
        authRole === 'customer'
          ? CUSTOMER_AUTH_URL
          : AUTH_URL

      const endpoint = `${baseUrl}/${authMode}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.detail ||
            `Authentication failed (${response.status}).`
        )
      }

      if (!data.token) {
        throw new Error(
          'The server did not return an authentication token.'
        )
      }

      // CUSTOMER ACCOUNT
      if (authRole === 'customer') {
        const account = {
          customerId: data.customerId,
          fullName: data.fullName,
          email: data.email,
          token: data.token,
          role: 'CUSTOMER',
        }

        localStorage.removeItem('chargeshareHost')
        setHostAccount(null)

        localStorage.setItem(
          'chargeshareCustomer',
          JSON.stringify(account)
        )

        setCustomerAccount(account)

        setShowHostForm(false)
        setShowHostDashboard(false)
        setHostChargers([])

        setAuthMessage(
          data.message || 'Customer sign-in successful.'
        )
      } else {
        // HOST ACCOUNT
        const account = {
          hostId: data.hostId,
          fullName: data.fullName,
          email: data.email,
          token: data.token,
          role: 'HOST',
        }

        localStorage.removeItem('chargeshareCustomer')
        setCustomerAccount(null)

        localStorage.setItem(
          'chargeshareHost',
          JSON.stringify(account)
        )

        setHostAccount(account)

        setAuthMessage(
          data.message || 'Host sign-in successful.'
        )

        if (authMode === 'signup') {
          setHostMessage(
            'Your host account is ready. You can now register a charger.'
          )

          setShowHostForm(true)

          window.setTimeout(
            () => scrollTo('host-registration'),
            150
          )
        }
      }

      setShowAuthForm(false)

      setAuthForm({
        fullName: '',
        email: '',
        password: '',
      })
    } catch (error) {
      console.error(
        `${authRole} authentication failed:`,
        error
      )

      setAuthError(
        error.message ||
          'Unable to authenticate. Please try again.'
      )
    } finally {
      setAuthLoading(false)
    }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem('chargeshareHost')
    localStorage.removeItem('chargeshareCustomer')

    setHostAccount(null)
    setCustomerAccount(null)

    setShowAuthForm(false)
    setShowHostForm(false)
    setShowHostDashboard(false)

    setHostChargers([])
    setHostMessage('')
    setHostError('')
    setDashboardError('')
    setAuthError('')
    setAuthMessage('')
  }

  // --------------------------------------------------
  // BOOKING SYSTEM
  const openBooking = (charger) => {
    if (!customerAccount?.token) { openAuth('login', 'customer'); return }
    setSelectedCharger(charger); setBookingError(''); setBookingMessage('')
    const d = new Date(Date.now() + 3600000); d.setMinutes(0,0,0)
    setBookingDate(localDateString(d)); setBookingTime(`${String(d.getHours()).padStart(2,'0')}:00`)
    setBookingDuration('1'); setCalendarView('week'); setCalendarBookings([]); setCalendarError(''); window.setTimeout(() => scrollTo('booking-section'), 120)
  }

  const handleCreateBooking = async (event) => {
    event.preventDefault()
    if (!customerAccount?.token || !selectedCharger) { openAuth('login', 'customer'); return }
    if (slotIsBusy(bookingDate, bookingTime)) { setBookingError('This start time conflicts with an existing booking. Choose another green time slot.'); return }
    setBookingLoading(true); setBookingError(''); setBookingMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAccount.token}` },
        body: JSON.stringify({ chargerId: selectedCharger.id, startTime: `${bookingDate}T${bookingTime}:00`, durationHours: Number(bookingDuration) })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || `Booking failed (${response.status}).`)
      setBookingMessage(`Booking #${data.id} created. Status: ${data.status}. Total: ₹${Number(data.totalPrice).toFixed(2)}.`)
      setSelectedCharger(null); await handleLoadCustomerBookings()
    } catch (error) { setBookingError(error.message || 'Unable to create booking.') }
    finally { setBookingLoading(false) }
  }

  const handleLoadCustomerBookings = async () => {
    if (!customerAccount?.token) { openAuth('login', 'customer'); return }
    setShowCustomerBookings(true); setBookingHistoryLoading(true); setBookingHistoryError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/customer`, { headers: { Authorization: `Bearer ${customerAccount.token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || `Could not load bookings (${response.status}).`)
      const bookings = Array.isArray(data) ? data : []
      setCustomerBookings(bookings)

      // Check which bookings already have a review, without blocking booking history if this endpoint is unavailable.
      const reviewChecks = await Promise.all(bookings.map(async (booking) => {
        try {
          const reviewResponse = await fetch(`${API_BASE_URL}/api/reviews/booking/${booking.id}/mine`, {
            headers: { Authorization: `Bearer ${customerAccount.token}` },
          })
          return reviewResponse.ok ? booking.id : null
        } catch {
          return null
        }
      }))
      setReviewedBookingIds(reviewChecks.filter((id) => id !== null))
      window.setTimeout(() => scrollTo('customer-bookings'), 100)
    } catch (error) { setBookingHistoryError(error.message || 'Unable to load booking history.') }
    finally { setBookingHistoryLoading(false) }
  }

  const handleReviewFieldChange = (bookingId, field, value) => {
    setReviewForms((previous) => ({
      ...previous,
      [bookingId]: {
        chargerRating: 5,
        hostDisciplineRating: 5,
        comment: '',
        ...previous[bookingId],
        [field]: value,
      },
    }))
    setReviewMessages((previous) => ({ ...previous, [bookingId]: null }))
  }

  const handleSubmitReview = async (event, booking) => {
    event.preventDefault()
    if (!customerAccount?.token) { openAuth('login', 'customer'); return }
    const form = { chargerRating: 5, hostDisciplineRating: 5, comment: '', ...reviewForms[booking.id] }
    if (form.comment.length > 1000) {
      setReviewMessages((previous) => ({ ...previous, [booking.id]: { error: 'Comment must be 1000 characters or fewer.' } }))
      return
    }
    setReviewSubmittingId(booking.id)
    setReviewMessages((previous) => ({ ...previous, [booking.id]: null }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${customerAccount.token}` },
        body: JSON.stringify({
          bookingId: booking.id,
          chargerRating: Number(form.chargerRating),
          hostDisciplineRating: Number(form.hostDisciplineRating),
          comment: form.comment.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || `Review submission failed (${response.status}).`)
      setReviewedBookingIds((previous) => previous.includes(booking.id) ? previous : [...previous, booking.id])
      setReviewMessages((previous) => ({ ...previous, [booking.id]: { success: 'Thank you! Your review was submitted.' } }))
    } catch (error) {
      setReviewMessages((previous) => ({ ...previous, [booking.id]: { error: error.message || 'Unable to submit review.' } }))
    } finally {
      setReviewSubmittingId(null)
    }
  }

  const handleCancelCustomerBooking = async (bookingId) => {
    if (!customerAccount?.token) { openAuth('login', 'customer'); return }
    const confirmed = window.confirm('Cancel this booking? This cannot be undone. If you already paid, contact the host about the payment before cancelling.');
    if (!confirmed) return

    setHostBookingActionId(bookingId)
    setBookingHistoryError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${customerAccount.token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || `Could not cancel booking (${response.status}).`)
      setCustomerBookings(previous => previous.map(booking => booking.id === bookingId ? { ...booking, ...data } : booking))
      setBookingHistoryError('')
    } catch (error) {
      setBookingHistoryError(error.message || 'Unable to cancel booking.')
    } finally {
      setHostBookingActionId(null)
    }
  }

  const handleLoadHostBookings = async () => {
    if (!hostAccount?.token) return
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/host`, { headers: { Authorization: `Bearer ${hostAccount.token}` } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || data.message || `Could not load bookings (${response.status}).`)
      setHostBookings(Array.isArray(data) ? data : []); setBookingHistoryError('')
    } catch (error) { setBookingHistoryError(error.message || 'Unable to load host bookings.') }
  }

  const handleHostBookingDecision = async (bookingId, decision) => {
    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }

    setHostBookingActionId(bookingId)
    setBookingHistoryError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookings/${bookingId}/${decision}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${hostAccount.token}`,
          },
        }
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error || data.message ||
          `Could not ${decision} booking (${response.status}).`
        )
      }

      setHostBookings((previous) =>
        previous.map((booking) =>
          booking.id === bookingId ? { ...booking, ...data } : booking
        )
      )
    } catch (error) {
      setBookingHistoryError(error.message || 'Unable to update booking.')
    } finally {
      setHostBookingActionId(null)
    }
  }

  // HOST MANUAL PAYMENT VERIFICATION
  const handlePaymentDecision = async (bookingId, decision) => {
    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }

    setHostBookingActionId(bookingId)
    setBookingHistoryError('')
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bookings/${bookingId}/payment/${decision}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${hostAccount.token}` },
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || data.message || `Payment update failed (${response.status}).`)
      }
      setHostBookings((previous) => previous.map((booking) =>
        booking.id === bookingId ? { ...booking, ...data } : booking
      ))
      setBookingHistoryError('')
    } catch (error) {
      setBookingHistoryError(error.message || 'Unable to update payment status.')
    } finally {
      setHostBookingActionId(null)
    }
  }

  const handleLoadHostEarnings = async () => {
    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }

    setEarningsLoading(true)
    setEarningsError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/earnings/host`, {
        headers: { Authorization: `Bearer ${hostAccount.token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || data.message || `Could not load earnings (${response.status}).`)
      }
      setEarnings(data)
    } catch (error) {
      setEarningsError(error.message || 'Unable to load earnings. Please try again.')
    } finally {
      setEarningsLoading(false)
    }
  }

  // HOST DASHBOARD
  // --------------------------------------------------

  const handleLoadHostDashboard = async () => {
    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }

    setShowHostDashboard(true)
    setDashboardLoading(true)
    setDashboardError('')

    try {
      const response = await fetch(`${API_URL}/mine`, {
        headers: {
          Authorization: `Bearer ${hostAccount.token}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const data = await response.json()

      setHostChargers(data)
      await Promise.all([handleLoadHostBookings(), handleLoadHostEarnings()])

      window.setTimeout(
        () => scrollTo('host-dashboard'),
        100
      )
    } catch (error) {
      console.error('Dashboard loading failed:', error)

      setDashboardError(
        'Could not load charger data. Check your backend and try again.'
      )
    } finally {
      setDashboardLoading(false)
    }
  }

  // --------------------------------------------------
  // HOST PAYMENT QR UPLOAD
  // --------------------------------------------------

  const handleUploadPaymentQr = async (chargerId) => {
    const file = qrFiles[chargerId]
    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }
    if (!file) {
      setQrUploadMessages((previous) => ({
        ...previous,
        [chargerId]: { error: 'Choose a PNG or JPG QR image first.' },
      }))
      return
    }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setQrUploadMessages((previous) => ({
        ...previous,
        [chargerId]: { error: 'Only PNG and JPG images are supported.' },
      }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setQrUploadMessages((previous) => ({
        ...previous,
        [chargerId]: { error: 'The QR image must be 5 MB or smaller.' },
      }))
      return
    }

    setQrUploadBusyId(chargerId)
    setQrUploadMessages((previous) => ({ ...previous, [chargerId]: {} }))
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_URL}/${chargerId}/payment-qr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hostAccount.token}` },
        body: formData,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || data.detail || `QR upload failed (${response.status}).`)
      }
      setHostChargers((previous) => previous.map((charger) =>
        charger.id === chargerId
          ? { ...charger, paymentQrPath: data.paymentQrPath }
          : charger
      ))
      setQrUploadMessages((previous) => ({
        ...previous,
        [chargerId]: { success: 'Payment QR uploaded successfully.' },
      }))
      setQrFiles((previous) => ({ ...previous, [chargerId]: null }))
    } catch (error) {
      setQrUploadMessages((previous) => ({
        ...previous,
        [chargerId]: { error: error.message || 'Could not upload the QR image.' },
      }))
    } finally {
      setQrUploadBusyId(null)
    }
  }

  // --------------------------------------------------
  // HOST FORM
  // --------------------------------------------------

  const handleHostChange = (event) => {
    const { name, value } = event.target

    setHostForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setHostMessage('')
    setHostError('')
  }

  const handleHostSubmit = async (event) => {
    event.preventDefault()

    if (!hostAccount?.token) {
      openAuth('login', 'host')
      return
    }

    setHostLoading(true)
    setHostMessage('')
    setHostError('')

    const payload = {
      name: hostForm.name.trim(),
      city: hostForm.city.trim(),
      address: hostForm.address.trim(),
      vehicleType: hostForm.vehicleType,
      pricePerHour: Number(hostForm.pricePerHour),
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostAccount.token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let message = `Registration failed (${response.status}).`

        try {
          const data = await response.json()

          if (data.message) {
            message = data.message
          }

          if (data.detail) {
            message = data.detail
          }
        } catch {
          // Keep the default error message.
        }

        throw new Error(message)
      }

      const savedCharger = await response.json()

      setHostMessage(
        `${savedCharger.name} was registered successfully and is listed as available.`
      )

      setHostForm(initialHostForm)

      if (showHostDashboard) {
        handleLoadHostDashboard()
      }
    } catch (error) {
      console.error('Charger registration failed:', error)

      setHostError(
        error.message ||
          'Unable to register your charger. Please try again.'
      )
    } finally {
      setHostLoading(false)
    }
  }

  const availableCount = hostChargers.filter(
    (charger) => charger.available
  ).length

  const unavailableCount = hostChargers.filter(
    (charger) => !charger.available
  ).length

  const vehicleTypeCount = new Set(
    hostChargers.map((charger) => charger.vehicleType)
  ).size

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <div className="app" id="home">
      <style>{`
        /* ChargeShare landing-page refresh: more space, clearer hierarchy */
        /* Customer bookings: spacious single-column cards and a calm review panel */
        #customer-bookings .search-result-grid { grid-template-columns: minmax(0, 1fr) !important; gap: 20px !important; }
        #customer-bookings .search-charger-card { width: 100%; box-sizing: border-box; padding: clamp(18px, 2.4vw, 30px) !important; }
        #customer-bookings .review-panel { margin-top: 22px; padding: clamp(18px, 2.5vw, 28px); border: 1px solid #d7e8dc; border-radius: 18px; background: linear-gradient(135deg, #fbfffc 0%, #f2faf4 100%); }
        #customer-bookings .review-panel h4 { margin: 0 0 18px; font-size: 1.2rem; color: #163c2a; }
        #customer-bookings .review-rating-block { margin: 18px 0; }
        #customer-bookings .review-rating-label { display: block; margin-bottom: 10px; font-weight: 650; color: #243b30; }
        #customer-bookings .review-stars { display: flex; flex-wrap: wrap; gap: 8px; }
        #customer-bookings .review-star { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid #cddbd1; border-radius: 12px; background: #fff; color: #a3b2a7; font-size: 1.55rem; cursor: pointer; transition: transform .15s ease, background .15s ease, border-color .15s ease; }
        #customer-bookings .review-star:hover { transform: translateY(-1px); border-color: #2f8a55; }
        #customer-bookings .review-star.is-selected { background: #e0f4e6; color: #168044; border-color: #69b783; }
        #customer-bookings .review-comment { display: block; width: 100%; box-sizing: border-box; min-height: 118px; margin-top: 8px; padding: 14px 15px; border: 1px solid #cfddd3; border-radius: 12px; background: #fff; color: #20372a; font: inherit; resize: vertical; }
        #customer-bookings .review-comment:focus { outline: 3px solid #d9f0e0; border-color: #328653; }
        #customer-bookings .review-form-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
        #customer-bookings .review-submitted { margin-top: 20px; padding: 18px 20px; border: 1px solid #b7dfc4; background: #f0fbf4; border-radius: 14px; color: #176638; }
        @media (max-width: 600px) { #customer-bookings .review-star { width: 40px; height: 40px; } #customer-bookings .search-charger-card { padding: 17px !important; } }
        .app .navbar { width: min(100% - 48px, 1240px); margin: 0 auto; padding: 22px 0; gap: 24px; }
        .app .nav-links { gap: clamp(12px, 1.8vw, 28px); flex-wrap: wrap; }
        .app .hero {
          width: min(100% - 64px, 1180px); margin: 0 auto;
          display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
          align-items: center; gap: clamp(36px, 5vw, 76px);
          padding: clamp(58px, 7vw, 94px) 0 clamp(68px, 8vw, 108px);
          min-height: 620px; box-sizing: border-box;
        }
        .app .hero-content { min-width: 0; max-width: 590px; }
        .app .hero h1 { font-size: clamp(42px, 5vw, 68px); line-height: 1.04; letter-spacing: -.045em; margin: 22px 0 24px; }
        .app .hero-description { max-width: 510px; font-size: 16px; line-height: 1.85; margin: 0 0 30px; }
        .app .hero-actions { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .app .trust-note { margin-top: 28px; }
        .app .hero-visual { min-width: 0; width: 100%; max-width: 500px; justify-self: end; position: relative; }
        .app .hero-art { width: 100%; box-sizing: border-box; padding: clamp(22px, 2.7vw, 34px); border-radius: 28px; }
        .app .vehicle-showcase { margin-top: 28px; }
        .app .showcase-heading { margin-bottom: 22px; }
        .app .vehicle-art { min-height: 132px; box-sizing: border-box; padding: 22px; }
        .app .vehicle-art-copy p { max-width: 210px; line-height: 1.5; }
        .app .vehicle-emoji { font-size: clamp(42px, 4vw, 58px); }
        .app .art-footer { margin-top: 20px; }
        .app .floating-card { display: none !important; }
        @media (max-width: 900px) {
          .app .navbar { width: min(100% - 32px, 760px); align-items: flex-start; }
          .app .nav-links { justify-content: flex-end; }
          .app .hero { width: min(100% - 40px, 760px); grid-template-columns: 1fr; gap: 42px; padding: 54px 0 70px; min-height: 0; }
          .app .hero-content { max-width: 680px; }
          .app .hero-visual { justify-self: center; max-width: 560px; }
          .app .hero h1 { font-size: clamp(42px, 8vw, 62px); }
        }
        @media (max-width: 560px) {
          .app .navbar { width: calc(100% - 28px); display: flex; flex-direction: column; align-items: stretch; gap: 16px; }
          .app .nav-links { justify-content: flex-start; gap: 10px; }
          .app .nav-links a, .app .nav-links button { font-size: 12px; }
          .app .hero { width: calc(100% - 32px); padding: 42px 0 54px; gap: 34px; }
          .app .hero h1 { font-size: clamp(38px, 11vw, 50px); line-height: 1.08; }
          .app .hero-description { font-size: 15px; line-height: 1.7; }
          .app .hero-art { padding: 20px; border-radius: 22px; }
          .app .art-topline { align-items: flex-start; gap: 10px; flex-wrap: wrap; }
          .app .live-badge { font-size: 9px; }
          .app .vehicle-art { padding: 16px; min-height: 125px; }
          .app .vehicle-art-copy p { max-width: 155px; font-size: 12px; }
          .app .vehicle-emoji { font-size: 38px; }
        }
      `}</style>
      <nav className="navbar">
        <a
          className="brand"
          href="#home"
          aria-label="ChargeShare home"
        >
          <span className="brand-icon">ϟ</span>
          <span>
            Charge<span className="brand-accent">Share</span>
          </span>
        </a>

        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#hosts">For hosts</a>

          {signedInAccount?.token ? (
            <>
              <span className="footer-note">
                Hi, {signedInAccount.fullName} (
                {hostAccount?.token ? 'Host' : 'Customer'})
              </span>

              <button
                className="login-btn"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              className="login-btn"
              type="button"
              onClick={() => openAuth('login', 'host')}
            >
              Log in
            </button>
          )}

          {customerAccount?.token && <button className="login-btn" type="button" onClick={handleLoadCustomerBookings}>My bookings</button>}

          <button
            className="nav-cta"
            type="button"
            onClick={() => scrollTo('find-chargers')}
          >
            Get started <span>↗</span>
          </button>
        </div>
      </nav>

      <main>
        {/* HERO SECTION */}

        <section className="hero">
          <div className="hero-content">
            <div className="eyebrow">
              <span className="status-dot" />
              A CHARGING NETWORK FOR EVERY RIDE
            </div>

            <h1>
              Find your next charge.
              <br />
              <span>Whatever you ride.</span>
            </h1>

            <p className="hero-description">
              Discover chargers shared by people around you. Whether
              you drive an electric car or ride an electric bike, find
              a charging point and get back on the road.
            </p>

            <div className="hero-actions">
              <button
                className="primary-btn"
                type="button"
                onClick={() => scrollTo('find-chargers')}
              >
                Find a charger <span>→</span>
              </button>

              <button
                className="secondary-link"
                type="button"
                onClick={() => scrollTo('hosts')}
              >
                Share your charger <span>↗</span>
              </button>
            </div>

            <div className="trust-note">
              <span className="check-icon">✓</span>
              Discover. Book. Charge. Repeat.
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-art">
              <div className="art-topline">
                <span className="mini-label">
                  CHARGESHARE COMMUNITY
                </span>

                <span className="live-badge">
                  <span /> MADE FOR EVERY RIDE
                </span>
              </div>

              <div className="vehicle-showcase">
                <div className="showcase-heading">
                  <span>One platform.</span>
                  <strong>Two ways to move.</strong>
                </div>

                <div className="vehicle-art car-art">
                  <div className="vehicle-art-copy">
                    <span className="vehicle-number">
                      01 / FOUR WHEELS
                    </span>
                    <h3>Electric cars</h3>
                    <p>
                      More charging options for your journey.
                    </p>
                  </div>

                  <div className="vehicle-emoji car-emoji">
                    🚙
                  </div>

                  <div className="art-charger">ϟ</div>
                </div>

                <div className="vehicle-art bike-art">
                  <div className="vehicle-art-copy">
                    <span className="vehicle-number">
                      02 / TWO WHEELS
                    </span>
                    <h3>Electric bikes</h3>
                    <p>
                      Convenient charging closer to home.
                    </p>
                  </div>

                  <div className="vehicle-emoji bike-emoji">
                    🛵
                  </div>

                  <div className="art-charger">ϟ</div>
                </div>
              </div>

              <div className="art-footer">
                <span className="art-footer-icon">ϟ</span>
                <div>
                  <strong>Energy, shared.</strong>
                  <small>
                    More use from chargers that already exist.
                  </small>
                </div>
              </div>
            </div>

            <div className="floating-card floating-top">
              <span className="floating-icon">⌖</span>
              <div>
                <strong>Find charging nearby</strong>
                <small>Search around your location</small>
              </div>
            </div>

            <div className="floating-card floating-bottom">
              <span className="floating-icon coin">₹</span>
              <div>
                <strong>Earn by sharing</strong>
                <small>Your charger. Your schedule.</small>
              </div>
            </div>
          </div>
        </section>

        {/* CUSTOMER AND HOST AUTHENTICATION */}

        {showAuthForm && (
          <section
            id="host-auth"
            className="host-registration"
          >
            <button
              type="button"
              className="secondary-link"
              onClick={() => setShowAuthForm(false)}
            >
              ← Close
            </button>

            <div className="section-heading">
              <span className="section-tag">
                CHARGESHARE{' '}
                {authRole === 'host' ? 'HOST' : 'CUSTOMER'} ACCOUNT
              </span>

              <h2>
                {authMode === 'signup' ? 'Create your ' : 'Welcome '}
                <span>
                  {authMode === 'signup'
                    ? `${authRole} account.`
                    : 'back.'}
                </span>
              </h2>

              <p>
                {authRole === 'host'
                  ? authMode === 'signup'
                    ? 'Create an account to register and manage your chargers.'
                    : 'Log in to manage your registered chargers.'
                  : authMode === 'signup'
                    ? 'Create an account to find and book shared chargers.'
                    : 'Log in to manage your customer account and bookings.'}
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  margin: '18px 0',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className={
                    authRole === 'customer'
                      ? 'primary-btn'
                      : 'secondary-link'
                  }
                  onClick={() => {
                    setAuthRole('customer')
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Customer
                </button>

                <button
                  type="button"
                  className={
                    authRole === 'host'
                      ? 'primary-btn'
                      : 'secondary-link'
                  }
                  onClick={() => {
                    setAuthRole('host')
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Host
                </button>
              </div>
            </div>

            <form
              className="host-form"
              onSubmit={handleAuthSubmit}
            >
              {authMode === 'signup' && (
                <div className="form-field">
                  <label htmlFor="auth-full-name">
                    Full name
                  </label>

                  <input
                    id="auth-full-name"
                    name="fullName"
                    value={authForm.fullName}
                    onChange={handleAuthChange}
                    placeholder="Your full name"
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="auth-email">
                  Email address
                </label>

                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={255}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="auth-password">
                  Password
                </label>

                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  placeholder="At least 8 characters"
                  autoComplete={
                    authMode === 'signup'
                      ? 'new-password'
                      : 'current-password'
                  }
                  minLength={
                    authMode === 'signup' ? 8 : undefined
                  }
                  maxLength={72}
                  required
                />
              </div>

              <button
                className="primary-btn"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'signup'
                    ? `Create ${authRole} account`
                    : `Log in as ${authRole}`}

                {!authLoading && <span> →</span>}
              </button>

              {authError && (
                <p className="error-message" role="alert">
                  {authError}
                </p>
              )}

              {authMessage && (
                <p className="success-message" role="status">
                  {authMessage}
                </p>
              )}

              <p>
                {authMode === 'signup'
                  ? 'Already have an account? '
                  : `Don't have a ${authRole} account? `}

                <button
                  type="button"
                  className="secondary-link"
                  onClick={() => {
                    setAuthMode(
                      authMode === 'signup' ? 'login' : 'signup'
                    )
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  {authMode === 'signup' ? 'Log in' : 'Sign up'}
                </button>
              </p>
            </form>
          </section>
        )}

        {/* BENEFITS */}

        <section className="benefits">
          <div className="benefit">
            <span className="benefit-icon">⌖</span>
            <div>
              <strong>Discover nearby</strong>
              <p>Explore shared charging points.</p>
            </div>
          </div>

          <div className="benefit">
            <span className="benefit-icon">▦</span>
            <div>
              <strong>Reserve your time</strong>
              <p>Choose an available time slot.</p>
            </div>
          </div>

          <div className="benefit">
            <span className="benefit-icon">ϟ</span>
            <div>
              <strong>Share the power</strong>
              <p>Help drivers and hosts benefit.</p>
            </div>
          </div>
        </section>

        {/* CHARGER SEARCH */}

        <section className="find-section" id="find-chargers">
          <div className="section-heading">
            <span className="section-tag">
              CHARGING THAT FITS YOUR RIDE
            </span>

            <h2>
              What do you <span>drive?</span>
            </h2>

            <p>
              Choose your vehicle to explore compatible charging options.
            </p>
          </div>

          <div className="vehicle-options">
            <button
              type="button"
              className={`vehicle-option ${
                vehicle === 'car' ? 'selected' : ''
              }`}
              onClick={() => {
                setVehicle('car')
                setSearchSubmitted(false)
                setChargers([])
                setSearchError('')
              }}
              aria-pressed={vehicle === 'car'}
            >
              <span className="option-check">
                {vehicle === 'car' ? '✓' : '+'}
              </span>

              <span className="option-art car">🚗</span>

              <span className="option-copy">
                <strong>Electric cars</strong>
                <small>Find a compatible car charger</small>
                <span>
                  Explore charging options for your car.
                </span>
              </span>

              <span className="option-arrow">→</span>
            </button>

            <button
              type="button"
              className={`vehicle-option ${
                vehicle === 'bike' ? 'selected' : ''
              }`}
              onClick={() => {
                setVehicle('bike')
                setSearchSubmitted(false)
                setChargers([])
                setSearchError('')
              }}
              aria-pressed={vehicle === 'bike'}
            >
              <span className="option-check">
                {vehicle === 'bike' ? '✓' : '+'}
              </span>

              <span className="option-art bike">🛵</span>

              <span className="option-copy">
                <strong>Electric bikes & scooters</strong>
                <small>Charge your everyday ride</small>
                <span>
                  Find suitable two-wheeler charging points.
                </span>
              </span>

              <span className="option-arrow">→</span>
            </button>
          </div>

          <form
            className="search-panel"
            onSubmit={handleSearch}
          >
            <div className="search-symbol">⌖</div>

            <div className="search-copy">
              <span className="mini-label">YOUR VEHICLE</span>

              <strong>
                {vehicle === 'car'
                  ? 'Electric car charging'
                  : 'Electric bike & scooter charging'}
              </strong>

              <span>
                Enter a city or area to find available chargers.
              </span>

              <label htmlFor="charger-location">
                City or area
              </label>

              <input
                id="charger-location"
                className="location-input"
                type="text"
                placeholder="e.g. Madhapur, Hyderabad"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value)
                  setSearchSubmitted(false)
                  setChargers([])
                  setSearchError('')
                }}
                required
              />
            </div>

            <button
              className="primary-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Explore chargers'}
              {!loading && <span>→</span>}
            </button>
          </form>

          {searchSubmitted && (
            <div className="search-result" aria-live="polite">
              <h3>Charger search results</h3>

              {loading && (
                <p>Searching available chargers...</p>
              )}

              {!loading && searchError && (
                <p className="error-message">
                  {searchError}
                </p>
              )}

              {!loading &&
                !searchError &&
                chargers.length === 0 && (
                  <p>
                    No available chargers found. Try another city or area.
                  </p>
                )}

              {!loading &&
                !searchError &&
                chargers.length > 0 && (
                  <>
                    <p className="recommendation-explainer">Recommended order: top-rated chargers first, followed by good and average reviews. New listings remain visible after reviewed chargers.</p>
                    <div className="search-result-grid">
                    {chargers.map((charger) => (
                      <article
                        className="search-charger-card"
                        key={charger.id}
                      >
                        <span className="result-vehicle">
                          {charger.vehicleType === 'car'
                            ? '🚗'
                            : '🛵'}
                        </span>

                        <h4>{charger.name}</h4>

                        <p>
                          {charger.address}, {charger.city}
                        </p>

                        <p>
                          {charger.vehicleType === 'car'
                            ? 'Electric car'
                            : 'Electric bike / scooter'}
                        </p>

                        <div className="charger-review-summary" aria-label="Charger customer rating">
                          {charger.reviewCount > 0 ? (
                            <>
                              <span className="charger-review-stars" aria-hidden="true">★</span>
                              <strong>{Number(charger.averageChargerRating).toFixed(1)}</strong>
                              <span className="charger-review-count">({charger.reviewCount} {charger.reviewCount === 1 ? 'review' : 'reviews'})</span>
                              {charger.averageChargerRating >= 4.5 && <span className="charger-recommendation-badge">Top rated</span>}
                              {charger.averageChargerRating >= 3.5 && charger.averageChargerRating < 4.5 && <span className="charger-recommendation-badge good">Good reviews</span>}
                              {charger.averageChargerRating < 3.5 && <span className="charger-recommendation-badge average">Average</span>}
                            </>
                          ) : (
                            <span className="charger-review-count">☆ New listing · No reviews yet</span>
                          )}
                        </div>

                        <strong>
                          ₹{charger.pricePerHour} / hour
                        </strong>

                        <span className="available-pill">
                          Available
                        </span>
                        <button className="primary-btn" type="button" onClick={() => openBooking(charger)} style={{ marginTop: '14px', width: '100%' }}>Book this charger →</button>
                      </article>
                    ))}
                    </div>
                  </>
                )}
            </div>
          )}
        </section>

        {/* BOOKING FORM AND LIVE AVAILABILITY CALENDAR */}
        {selectedCharger && <section className="host-registration" id="booking-section">
          <button type="button" className="secondary-link" onClick={() => setSelectedCharger(null)}>← Cancel</button>
          <div className="section-heading"><span className="section-tag">LIVE CHARGER AVAILABILITY</span><h2>Book <span>{selectedCharger.name}</span></h2><p>{selectedCharger.address}, {selectedCharger.city} · ₹{selectedCharger.pricePerHour} per hour</p></div>

          <div style={{ border: '1px solid #dce9e0', borderRadius: '18px', background: '#fff', padding: 'clamp(14px, 2.5vw, 24px)', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div><h3 style={{ margin: '0 0 4px', color: '#173b2a' }}>Availability calendar</h3><p style={{ margin: 0, color: '#64748b', fontSize: '.92rem' }}>Select a free half-hour start time. Your chosen duration must fit entirely in a free period.</p></div>
              <div style={{ display: 'flex', gap: '6px', padding: '4px', background: '#edf5ef', borderRadius: '12px' }}>
                {['day', 'week'].map(view => <button key={view} type="button" onClick={() => setCalendarView(view)} aria-pressed={calendarView === view} style={{ border: 0, borderRadius: '9px', padding: '9px 15px', cursor: 'pointer', textTransform: 'capitalize', fontWeight: 700, background: calendarView === view ? '#187545' : 'transparent', color: calendarView === view ? '#fff' : '#365447' }}>{view} view</button>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
              <label htmlFor="booking-date" style={{ fontWeight: 650 }}>Date</label>
              <input id="booking-date" type="date" value={bookingDate} min={localDateString(new Date())} onChange={e => { setBookingDate(e.target.value); setBookingError('') }} required style={{ padding: '9px 11px', border: '1px solid #cbd9cf', borderRadius: '9px' }} />
              <span style={{ color: '#64748b', fontSize: '.88rem' }}>Green = available · Red = booked · Grey = unavailable/past</span>
              <button type="button" className="secondary-link" onClick={() => { setCalendarBookings([]); setCalendarError(''); setBookingDate(localDateString(new Date())) }} style={{ marginLeft: 'auto' }}>Today</button>
            </div>
            {calendarLoading && <p role="status">Loading live availability…</p>}
            {calendarError && <p className="error-message" role="alert">{calendarError} Booking submission will still be checked by the server.</p>}
            {!calendarLoading && !calendarError && <div style={{ overflowX: 'auto', border: '1px solid #e2ebe5', borderRadius: '12px' }}>
              <div style={{ minWidth: calendarView === 'week' ? '760px' : '320px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: calendarView === 'week' ? '72px repeat(7, minmax(82px, 1fr))' : '72px minmax(220px, 1fr)', background: '#f4f8f5', borderBottom: '1px solid #e2ebe5' }}>
                  <div style={{ padding: '12px 6px', fontSize: '.75rem', color: '#64748b', textAlign: 'center' }}>TIME</div>
                  {(calendarView === 'week' ? Array.from({ length: 7 }, (_, i) => { const { start } = calendarRange(bookingDate, 'week'); const d = new Date(start); d.setDate(start.getDate() + i); return localDateString(d) }) : [bookingDate]).map(date => <div key={date} style={{ padding: '10px 4px', textAlign: 'center', borderLeft: '1px solid #e2ebe5', fontSize: '.82rem', fontWeight: 700, color: '#214b34' }}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>)}
                </div>
                {Array.from({ length: 32 }, (_, i) => {
                  const minutes = 6 * 60 + i * 30
                  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
                  const dates = calendarView === 'week' ? Array.from({ length: 7 }, (_, j) => { const { start } = calendarRange(bookingDate, 'week'); const d = new Date(start); d.setDate(start.getDate() + j); return localDateString(d) }) : [bookingDate]
                  return <div key={time} style={{ display: 'grid', gridTemplateColumns: calendarView === 'week' ? '72px repeat(7, minmax(82px, 1fr))' : '72px minmax(220px, 1fr)', minHeight: '38px', borderBottom: '1px solid #edf2ee' }}>
                    <div style={{ padding: '10px 5px', fontSize: '.75rem', color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>{time}</div>
                    {dates.map(date => {
                      const slotStart = dateAtLocalTime(date, time)
                      const isPast = slotStart <= new Date()
                      const busy = slotIsBusy(date, time)
                      const selected = bookingDate === date && bookingTime === time
                      const disabled = isPast || busy || calendarLoading || Boolean(calendarError)
                      return <button key={`${date}-${time}`} type="button" disabled={disabled} onClick={() => selectCalendarSlot(date, time)} title={busy ? 'This time overlaps an active booking' : isPast ? 'This time has passed' : `Select ${date} at ${time}`} style={{ border: 0, borderLeft: '1px solid #edf2ee', margin: '3px', borderRadius: '6px', padding: '5px 2px', cursor: disabled ? 'not-allowed' : 'pointer', background: selected ? '#176b3b' : busy ? '#fde8e7' : isPast ? '#f1f3f2' : '#e5f5e9', color: selected ? '#fff' : busy ? '#a8322a' : isPast ? '#9aa5a0' : '#21643a', fontSize: '.72rem', fontWeight: 650, opacity: disabled && !busy && !isPast ? .55 : 1 }}>{selected ? 'Selected' : busy ? 'Booked' : isPast ? '—' : 'Free'}</button>
                    })}
                  </div>
                })}
              </div>
            </div>}
            <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: '.85rem' }}>Calendar shows 06:00–22:00 in 30-minute increments. Active pending and approved bookings block overlapping slots.</p>
          </div>

          <form className="host-form" onSubmit={handleCreateBooking}>
            <div className="form-field"><label htmlFor="booking-time">Selected start time</label><input id="booking-time" type="time" step="1800" value={bookingTime} onChange={e => setBookingTime(e.target.value)} required /></div>
            <div className="form-field"><label htmlFor="booking-duration">Duration</label><select id="booking-duration" value={bookingDuration} onChange={e => setBookingDuration(e.target.value)} required>{Array.from({length:24},(_,i)=>i+1).map(h=><option key={h} value={h}>{h} hour{h>1?'s':''}</option>)}</select></div>
            {slotIsBusy(bookingDate, bookingTime) && <p className="error-message" role="alert">This start time conflicts with an existing booking. Choose another green time slot.</p>}
            <div className="dashboard-notice"><span className="notice-icon">₹</span><div><strong>Estimated total: ₹{(Number(selectedCharger.pricePerHour)*Number(bookingDuration||1)).toFixed(2)}</strong><p>Requests are saved with status PENDING. The server performs the final overlap check when you confirm.</p></div></div>
            <button className="primary-btn" type="submit" disabled={bookingLoading || slotIsBusy(bookingDate, bookingTime)}>{bookingLoading?'Booking...':'Confirm booking →'}</button>
            {bookingError && <p className="error-message" role="alert">{bookingError}</p>}{bookingMessage && <p className="success-message" role="status">{bookingMessage}</p>}
          </form>
        </section>}

        {/* CUSTOMER BOOKING HISTORY */}
        {showCustomerBookings && customerAccount?.token && <section className="host-dashboard" id="customer-bookings">
          <div className="dashboard-hero"><div className="dashboard-hero-top"><div className="dashboard-brand-icon">ϟ</div><span className="dashboard-live"><span className="dashboard-live-dot"/> CHARGESHARE CUSTOMER CENTER</span><button className="dashboard-close" type="button" onClick={()=>setShowCustomerBookings(false)}>✕ Close</button></div>
            <div className="dashboard-hero-content"><div><p className="dashboard-eyebrow">YOUR RESERVATIONS</p><h2>My <span>Bookings</span></h2><p className="dashboard-hero-description">Review your saved charger reservations and booking status.</p></div><div className="dashboard-hero-symbol">▦</div></div>
            <div className="dashboard-hero-bottom"><span>Bookings are stored in your ChargeShare database.</span><button className="dashboard-refresh" type="button" onClick={handleLoadCustomerBookings} disabled={bookingHistoryLoading}>{bookingHistoryLoading?'Refreshing...':'↻ Refresh'}</button></div></div>
          <div className="dashboard-body">
            {bookingHistoryError && <p className="error-message" role="alert">{bookingHistoryError}</p>}
            {bookingHistoryLoading ? <p>Loading your bookings...</p> : customerBookings.length === 0 ? (
              <div className="dashboard-empty"><h3>No bookings yet</h3><p>Search for a charger and choose “Book this charger”.</p></div>
            ) : (
              <div className="search-result-grid">
                {customerBookings.map((b) => {
                  const qrUrl = b.paymentQrPath
                    ? (b.paymentQrPath.startsWith('http') ? b.paymentQrPath : `${API_BASE_URL}${b.paymentQrPath}`)
                    : null
                  return (
                    <article className="search-charger-card" key={b.id}>
                      <span className="result-vehicle">{b.vehicleType === 'car' ? '🚗' : '🛵'}</span>
                      <h4>{b.chargerName}</h4>
                      <p>{b.address}, {b.city}</p>
                      <p>Start: {String(b.startTime || '').replace('T', ' ')}</p>
                      <p>End: {String(b.endTime || '').replace('T', ' ')}</p>
                      <strong>Amount: ₹{Number(b.totalPrice).toFixed(2)}</strong>
                      <p>Booking status: <strong>{b.status}</strong></p>
                      <p>Payment status: <strong>{b.paymentStatus || 'PENDING'}</strong></p>
                      {['PENDING', 'APPROVED'].includes(String(b.status || '').toUpperCase()) && String(b.paymentStatus || 'PENDING').toUpperCase() !== 'VERIFIED' && (
                        <button
                          className="secondary-link"
                          type="button"
                          onClick={() => handleCancelCustomerBooking(b.id)}
                          disabled={hostBookingActionId === b.id}
                          style={{ marginTop: '12px', color: '#b42318', borderColor: '#f0b7b2' }}
                        >
                          {hostBookingActionId === b.id ? 'Cancelling...' : 'Cancel Booking'}
                        </button>
                      )}
                      {String(b.status).toUpperCase() === 'APPROVED' && String(b.paymentStatus || 'PENDING').toUpperCase() === 'PENDING' && (
                        <div style={{ marginTop: '14px', padding: '14px', border: '1px solid #dbe7df', borderRadius: '12px' }}>
                          <h4 style={{ marginTop: 0 }}>Pay the host</h4>
                          {qrUrl ? (
                            <>
                              <p>Scan this host QR code with your payment app and pay exactly <strong>₹{Number(b.totalPrice).toFixed(2)}</strong>.</p>
                              <img src={qrUrl} alt={`Payment QR for ${b.chargerName}`} style={{ display: 'block', width: '190px', maxWidth: '100%', padding: '8px', background: '#fff', border: '1px solid #dbe7df', borderRadius: '12px' }} />
                              <p style={{ fontSize: '0.88rem', color: '#64748b' }}>After paying, the host must check the actual transaction before confirming it. Payment is not verified automatically.</p>
                            </>
                          ) : <p>The host has not uploaded a payment QR for this charger yet.</p>}
                        </div>
                      )}
                      {(() => {
                        const bookingEnded = b.endTime && new Date(b.endTime).getTime() < Date.now()
                        const eligibleForReview = String(b.status || '').toUpperCase() === 'APPROVED' && String(b.paymentStatus || '').toUpperCase() === 'VERIFIED' && bookingEnded
                        const reviewForm = { chargerRating: 5, hostDisciplineRating: 5, comment: '', ...reviewForms[b.id] }
                        const reviewMessage = reviewMessages[b.id]
                        if (reviewedBookingIds.includes(b.id)) {
                          return <div className="review-submitted"><strong>✓ Review submitted</strong><p style={{ marginBottom: 0, marginTop: '6px' }}>Thank you for helping other drivers make better charging decisions.</p></div>
                        }
                        if (!eligibleForReview) return null
                        return (
                          <form className="review-panel" onSubmit={(event) => handleSubmitReview(event, b)}>
                            <h4>Share your charging experience</h4>
                            <p style={{ marginTop: '-8px', color: '#647568', lineHeight: 1.55 }}>Your feedback helps drivers choose reliable chargers and hosts.</p>
                            <div className="review-rating-block">
                              <span className="review-rating-label">Charger experience</span>
                              <div className="review-stars" role="group" aria-label="Charger experience rating">
                                {[1, 2, 3, 4, 5].map((rating) => <button key={rating} className={`review-star ${Number(reviewForm.chargerRating) >= rating ? 'is-selected' : ''}`} type="button" aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'} for charger experience`} aria-pressed={Number(reviewForm.chargerRating) === rating} onClick={() => handleReviewFieldChange(b.id, 'chargerRating', rating)}>{Number(reviewForm.chargerRating) >= rating ? '★' : '☆'}</button>)}
                                <span style={{ alignSelf: 'center', marginLeft: '6px', color: '#496453', fontSize: '.92rem' }}>{reviewForm.chargerRating}/5</span>
                              </div>
                            </div>
                            <div className="review-rating-block">
                              <span className="review-rating-label">Host discipline & reliability</span>
                              <div className="review-stars" role="group" aria-label="Host reliability rating">
                                {[1, 2, 3, 4, 5].map((rating) => <button key={rating} className={`review-star ${Number(reviewForm.hostDisciplineRating) >= rating ? 'is-selected' : ''}`} type="button" aria-label={`${rating} ${rating === 1 ? 'star' : 'stars'} for host reliability`} aria-pressed={Number(reviewForm.hostDisciplineRating) === rating} onClick={() => handleReviewFieldChange(b.id, 'hostDisciplineRating', rating)}>{Number(reviewForm.hostDisciplineRating) >= rating ? '★' : '☆'}</button>)}
                                <span style={{ alignSelf: 'center', marginLeft: '6px', color: '#496453', fontSize: '.92rem' }}>{reviewForm.hostDisciplineRating}/5</span>
                              </div>
                            </div>
                            <label className="review-rating-label" htmlFor={`review-comment-${b.id}`}>Comment <span style={{ fontWeight: 400, color: '#718278' }}>(optional)</span></label>
                            <textarea id={`review-comment-${b.id}`} className="review-comment" value={reviewForm.comment} maxLength={1000} rows={4} onChange={(event) => handleReviewFieldChange(b.id, 'comment', event.target.value)} placeholder="What went well? You can mention charger condition, access, cleanliness or host communication…" />
                            <div className="review-form-footer">
                              <span style={{ fontSize: '.85rem', color: '#718278' }}>{reviewForm.comment.length}/1000 characters</span>
                              <button className="primary-btn" type="submit" disabled={reviewSubmittingId === b.id}>{reviewSubmittingId === b.id ? 'Submitting review…' : 'Submit review →'}</button>
                            </div>
                            {reviewMessage?.error && <p className="error-message" role="alert">{reviewMessage.error}</p>}
                            {reviewMessage?.success && <p className="success-message" role="status">{reviewMessage.success}</p>}
                          </form>
                        )
                      })()}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>}

        {/* HOW IT WORKS */}

        <section
          className="how-section"
          id="how-it-works"
        >
          <div className="section-heading">
            <span className="section-tag">
              SIMPLE BY DESIGN
            </span>

            <h2>
              Three steps. <span>More freedom.</span>
            </h2>
          </div>

          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span>
              <div className="step-icon">⌖</div>
              <h3>Discover</h3>
              <p>
                Find nearby shared chargers suitable for your vehicle.
              </p>
            </article>

            <article className="step-card">
              <span className="step-number">02</span>
              <div className="step-icon">▦</div>
              <h3>Book</h3>
              <p>
                Select a convenient time and review the estimated cost.
              </p>
            </article>

            <article className="step-card">
              <span className="step-number">03</span>
              <div className="step-icon">ϟ</div>
              <h3>Charge</h3>
              <p>
                Follow the host's access instructions and charge safely.
              </p>
            </article>
          </div>
        </section>

        {/* HOST SECTION */}

        <section className="host-section" id="hosts">
          <div className="host-copy">
            <span className="section-tag">
              TURN IDLE TIME INTO VALUE
            </span>

            <h2>
              Your charger can do <span>more.</span>
            </h2>

            <p>
              Share your home or private charger when it is available.
              Register your charging point, choose your vehicle type,
              and set your hourly price.
            </p>

            <div className="host-actions">
              <button
                className="primary-btn"
                type="button"
                onClick={() => {
                  if (!hostAccount?.token) {
                    openAuth('signup', 'host')
                    return
                  }

                  setShowHostForm(true)

                  window.setTimeout(
                    () => scrollTo('host-registration'),
                    100
                  )
                }}
              >
                Become a host <span>→</span>
              </button>

              <button
                className="secondary-link"
                type="button"
                onClick={handleLoadHostDashboard}
              >
                View Host Dashboard <span>↗</span>
              </button>
            </div>

            <p className="host-safety">
              Only list charging equipment that is safe and suitable for
              the vehicles you intend to support.
            </p>
          </div>

          <div className="host-art">
            <div className="host-orbit orbit-one" />
            <div className="host-orbit orbit-two" />
            <div className="host-bolt">ϟ</div>
            <span className="host-art-label">SHARE POWER</span>
          </div>
        </section>

        {/* HOST DASHBOARD */}

        {showHostDashboard && (
          <section
            id="host-dashboard"
            className="host-dashboard"
          >
            <div className="dashboard-hero">
              <div className="dashboard-hero-top">
                <div className="dashboard-brand-icon">ϟ</div>

                <span className="dashboard-live">
                  <span className="dashboard-live-dot" />
                  CHARGESHARE HOST CENTER
                </span>

                <button
                  className="dashboard-close"
                  type="button"
                  onClick={() => setShowHostDashboard(false)}
                >
                  ✕ Close
                </button>
              </div>

              <div className="dashboard-hero-content">
                <div>
                  <p className="dashboard-eyebrow">
                    YOUR CHARGING NETWORK
                  </p>

                  <h2>
                    Host <span>Dashboard</span>
                  </h2>

                  <p className="dashboard-hero-description">
                    Manage your charging network and keep every ride moving.
                  </p>
                </div>

                <div className="dashboard-hero-symbol">⚡</div>
              </div>

              <div className="dashboard-hero-bottom">
                <span>
                  ⚡ Share power. Earn value. Move forward.
                </span>

                <button
                  className="dashboard-refresh"
                  type="button"
                  onClick={handleLoadHostDashboard}
                  disabled={dashboardLoading}
                >
                  {dashboardLoading
                    ? 'Refreshing...'
                    : '↻ Refresh data'}
                </button>
              </div>
            </div>

            <div className="dashboard-body">
              <div className="dashboard-welcome">
                <div>
                  <h3>Your charging overview</h3>
                  <p>
                    Monitor the chargers currently registered on the platform.
                  </p>
                </div>

                <span className="dashboard-data-label">
                  <span /> LIVE DATA
                </span>
              </div>

              <div className="dashboard-stats">
                <article className="dashboard-stat stat-purple">
                  <div className="stat-icon">ϟ</div>
                  <p>Total chargers</p>

                  <strong>
                    {dashboardLoading
                      ? '—'
                      : hostChargers.length}
                  </strong>

                  <span>Registered on platform</span>
                </article>

                <article className="dashboard-stat stat-teal">
                  <div className="stat-icon">✓</div>
                  <p>Available</p>

                  <strong>
                    {dashboardLoading
                      ? '—'
                      : availableCount}
                  </strong>

                  <span>Ready to be discovered</span>
                </article>

                <article className="dashboard-stat stat-orange">
                  <div className="stat-icon">⌁</div>
                  <p>Unavailable</p>

                  <strong>
                    {dashboardLoading
                      ? '—'
                      : unavailableCount}
                  </strong>

                  <span>Currently not available</span>
                </article>

                <article className="dashboard-stat stat-blue">
                  <div className="stat-icon">₹</div>
                  <p>Vehicle types</p>

                  <strong>
                    {dashboardLoading
                      ? '—'
                      : vehicleTypeCount}
                  </strong>

                  <span>Supported categories</span>
                </article>
              </div>

              <section className="earnings-panel" aria-labelledby="earnings-heading">
                <div className="earnings-panel-heading">
                  <div>
                    <span className="section-tag">HOST FINANCES</span>
                    <h3 id="earnings-heading">Earnings overview</h3>
                    <p>Track verified payments and amounts awaiting verification.</p>
                  </div>
                  <button className="dashboard-refresh earnings-refresh" type="button" onClick={handleLoadHostEarnings} disabled={earningsLoading}>
                    {earningsLoading ? 'Refreshing...' : '↻ Refresh earnings'}
                  </button>
                </div>

                {earningsError && <div className="dashboard-error" role="alert"><strong>Unable to load earnings</strong><p>{earningsError}</p><button type="button" onClick={handleLoadHostEarnings}>Try again</button></div>}

                <div className="earnings-stats">
                  <article className="earnings-stat earnings-total"><span className="earnings-stat-icon">₹</span><span className="earnings-stat-label">Verified earnings</span><strong>{earningsLoading && !earnings ? '—' : `₹${Number(earnings?.verifiedEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><small>Payments verified by you</small></article>
                  <article className="earnings-stat earnings-pending"><span className="earnings-stat-icon">◷</span><span className="earnings-stat-label">Pending payments</span><strong>{earningsLoading && !earnings ? '—' : `₹${Number(earnings?.pendingPayments || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</strong><small>Awaiting payment verification</small></article>
                  <article className="earnings-stat earnings-completed"><span className="earnings-stat-icon">✓</span><span className="earnings-stat-label">Completed bookings</span><strong>{earningsLoading && !earnings ? '—' : Number(earnings?.completedBookings || 0)}</strong><small>Bookings whose end time has passed</small></article>
                </div>

                <div className="earnings-chart-heading"><div><h4>Monthly verified earnings</h4><p>{earnings?.year || new Date().getFullYear()} · INR</p></div></div>
                {earningsLoading && !earnings ? <p className="earnings-empty">Loading earnings data...</p> : (earnings?.monthlyEarnings || []).length === 0 ? <p className="earnings-empty">No monthly earnings data available yet.</p> : <div className="earnings-chart" role="img" aria-label="Monthly verified earnings bar chart">{earnings.monthlyEarnings.map((month) => {
                  const maxAmount = Math.max(1, ...earnings.monthlyEarnings.map((item) => Number(item.amount || 0)))
                  const amount = Number(month.amount || 0)
                  return <div className="earnings-month" key={`${month.year}-${month.monthNumber}`} title={`${month.month}: ₹${amount.toFixed(2)}`}><div className="earnings-bar-track"><div className={`earnings-bar ${amount > 0 ? 'has-earnings' : ''}`} style={{ height: `${amount > 0 ? Math.max(5, amount / maxAmount * 100) : 0}%` }} /></div><span className="earnings-month-label">{month.month}</span><span className="earnings-month-value">₹{amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
                })}</div>}
              </section>

              <div className="dashboard-list-heading">
                <div>
                  <h3>Registered chargers</h3>
                  <p>Current charger listings</p>
                </div>

                <span className="dashboard-count">
                  {hostChargers.length} LISTINGS
                </span>
              </div>

              {dashboardError && (
                <div
                  className="dashboard-error"
                  role="alert"
                >
                  <strong>Unable to load chargers</strong>
                  <p>{dashboardError}</p>

                  <button
                    type="button"
                    onClick={handleLoadHostDashboard}
                  >
                    Try again
                  </button>
                </div>
              )}

              {dashboardLoading && (
                <div className="dashboard-empty">
                  <div className="dashboard-loading-icon">↻</div>
                  <h3>Loading charger data...</h3>
                  <p>
                    Please wait while we connect to the server.
                  </p>
                </div>
              )}

              {!dashboardLoading &&
                !dashboardError &&
                hostChargers.length === 0 && (
                  <div className="dashboard-empty">
                    <div className="dashboard-empty-icon">ϟ</div>
                    <h3>No chargers registered yet</h3>

                    <p>
                      Register a charger to start building your network.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setShowHostForm(true)

                        window.setTimeout(
                          () => scrollTo('host-registration'),
                          100
                        )
                      }}
                    >
                      + Register a charger
                    </button>
                  </div>
                )}

              {!dashboardLoading &&
                !dashboardError &&
                hostChargers.length > 0 && (
                  <div className="dashboard-charger-grid">
                    {hostChargers.map((charger, index) => (
                      <article
                        className="dashboard-charger"
                        key={charger.id}
                      >
                        <div
                          className={`charger-card-top charger-color-${
                            index % 4
                          }`}
                        >
                          <div className="charger-card-icon">
                            {charger.vehicleType === 'car'
                              ? '🚗'
                              : '🛵'}
                          </div>

                          <span
                            className={`charger-status ${
                              charger.available
                                ? 'is-available'
                                : 'is-unavailable'
                            }`}
                          >
                            <span />

                            {charger.available
                              ? 'Available'
                              : 'Unavailable'}
                          </span>
                        </div>

                        <div className="charger-card-content">
                          <span className="charger-card-id">
                            CHARGER #{charger.id}
                          </span>

                          <h4>{charger.name}</h4>

                          <p className="charger-card-location">
                            <span>⌖</span>
                            {charger.address}, {charger.city}
                          </p>

                          <div className="charger-card-details">
                            <div>
                              <span>VEHICLE TYPE</span>

                              <strong>
                                {charger.vehicleType === 'car'
                                  ? 'Electric car'
                                  : 'Electric bike / scooter'}
                              </strong>
                            </div>

                            <div className="charger-price">
                              <span>HOURLY RATE</span>
                              <strong>
                                ₹{charger.pricePerHour}
                              </strong>
                            </div>
                          </div>

                          <div className="charger-card-footer">
                            <span>
                              <span className="charger-footer-dot" />
                              Listing on ChargeShare
                            </span>

                            <span className="charger-card-arrow">
                              ↗
                            </span>
                          </div>
                        </div>

                        <div style={{ padding: '16px', borderTop: '1px solid #e5eee8' }}>
                          <h4 style={{ margin: '0 0 8px' }}>Payment QR code</h4>
                          <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#64748b' }}>
                            Upload the QR customers should scan to pay for this charger.
                          </p>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                            aria-label={`Payment QR image for ${charger.name}`}
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null
                              setQrFiles((previous) => ({ ...previous, [charger.id]: file }))
                              setQrUploadMessages((previous) => ({ ...previous, [charger.id]: {} }))
                            }}
                            style={{ display: 'block', width: '100%', marginBottom: '12px' }}
                          />
                          <button
                            className="primary-btn"
                            type="button"
                            onClick={() => handleUploadPaymentQr(charger.id)}
                            disabled={qrUploadBusyId === charger.id}
                          >
                            {qrUploadBusyId === charger.id ? 'Uploading QR...' : charger.paymentQrPath ? 'Replace payment QR' : 'Upload payment QR'}
                          </button>
                          {qrUploadMessages[charger.id]?.error && (
                            <p className="error-message" role="alert">{qrUploadMessages[charger.id].error}</p>
                          )}
                          {qrUploadMessages[charger.id]?.success && (
                            <p className="success-message" role="status">{qrUploadMessages[charger.id].success}</p>
                          )}
                          {charger.paymentQrPath && (
                            <div style={{ marginTop: '14px' }}>
                              <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Current QR code</p>
                              <img
                                src={charger.paymentQrPath.startsWith('http') ? charger.paymentQrPath : `${API_BASE_URL}${charger.paymentQrPath}`}
                                alt={`Payment QR code for ${charger.name}`}
                                style={{ display: 'block', width: '180px', maxWidth: '100%', border: '1px solid #dbe7df', borderRadius: '12px', padding: '8px', background: '#fff' }}
                              />
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

              <div className="dashboard-list-heading">
                <div>
                  <h3>Booking requests</h3>
                  <p>Reservations for chargers registered by your account</p>
                </div>
                <button
                  className="dashboard-refresh"
                  type="button"
                  onClick={handleLoadHostBookings}
                  disabled={hostBookingActionId !== null}
                >
                  ↻ Refresh bookings
                </button>
              </div>

              {bookingHistoryError && (
                <p className="error-message" role="alert">
                  {bookingHistoryError}
                </p>
              )}

              {hostBookings.length === 0 && (
                <div className="dashboard-empty">
                  <h3>No booking requests yet</h3>
                  <p>Customer reservations for your chargers will appear here.</p>
                </div>
              )}

              {hostBookings.length > 0 && (
                <div className="search-result-grid">
                  {hostBookings.map((b) => (
                    <article className="search-charger-card" key={b.id}>
                      <span className="result-vehicle">
                        {b.vehicleType === 'car' ? '🚗' : '🛵'}
                      </span>
                      <h4>{b.chargerName}</h4>
                      <p>{b.address}, {b.city}</p>
                      <p>Customer: {b.customerName} ({b.customerEmail})</p>
                      <p>Start: {String(b.startTime || '').replace('T', ' ')}</p>
                      <p>End: {String(b.endTime || '').replace('T', ' ')}</p>
                      <strong>₹{Number(b.totalPrice).toFixed(2)}</strong>
                      <span className="available-pill">{b.status}</span>
                      <p>Payment status: <strong>{b.paymentStatus || 'PENDING'}</strong></p>

                      {String(b.status).toUpperCase() === 'APPROVED' && String(b.paymentStatus || 'PENDING').toUpperCase() === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                          <button className="primary-btn" type="button" onClick={() => handlePaymentDecision(b.id, 'verify')} disabled={hostBookingActionId !== null}>
                            {hostBookingActionId === b.id ? 'Updating...' : 'Verify payment'}
                          </button>
                          <button className="secondary-link" type="button" onClick={() => handlePaymentDecision(b.id, 'reject')} disabled={hostBookingActionId !== null}>
                            Reject payment
                          </button>
                        </div>
                      )}

                      {String(b.status).toUpperCase() === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                          <button
                            className="primary-btn"
                            type="button"
                            onClick={() => handleHostBookingDecision(b.id, 'approve')}
                            disabled={hostBookingActionId !== null}
                          >
                            {hostBookingActionId === b.id ? 'Updating...' : 'Approve'}
                          </button>
                          <button
                            className="secondary-link"
                            type="button"
                            onClick={() => handleHostBookingDecision(b.id, 'reject')}
                            disabled={hostBookingActionId !== null}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <div className="dashboard-notice">
                <span className="notice-icon">ⓘ</span>
                <div>
                  <strong>Booking management</strong>
                  <p>Approve or reject pending requests. The booking status is saved by the server and shown here after the decision.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* HOST CHARGER REGISTRATION */}

        {showHostForm && (
          <section
            id="host-registration"
            className="host-registration"
          >
            <button
              type="button"
              className="secondary-link"
              onClick={() => setShowHostForm(false)}
            >
              ← Close registration
            </button>

            <div className="section-heading">
              <span className="section-tag">
                HOST YOUR CHARGER
              </span>

              <h2>
                List your <span>charging point.</span>
              </h2>

              <p>
                Enter your charger details to publish a listing.
              </p>
            </div>

            <form
              className="host-form"
              onSubmit={handleHostSubmit}
            >
              <div className="form-field">
                <label htmlFor="host-name">
                  Charger name
                </label>

                <input
                  id="host-name"
                  name="name"
                  value={hostForm.name}
                  onChange={handleHostChange}
                  placeholder="e.g. Home EV Charging Point"
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="host-city">City</label>

                <input
                  id="host-city"
                  name="city"
                  value={hostForm.city}
                  onChange={handleHostChange}
                  placeholder="e.g. Hyderabad"
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="host-address">
                  Full address or area
                </label>

                <input
                  id="host-address"
                  name="address"
                  value={hostForm.address}
                  onChange={handleHostChange}
                  placeholder="e.g. Madhapur, Hyderabad"
                  maxLength={255}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="host-vehicle">
                  Vehicle supported
                </label>

                <select
                  id="host-vehicle"
                  name="vehicleType"
                  value={hostForm.vehicleType}
                  onChange={handleHostChange}
                  required
                >
                  <option value="car">Electric car</option>
                  <option value="bike">
                    Electric bike / scooter
                  </option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="host-price">
                  Price per hour (₹)
                </label>

                <input
                  id="host-price"
                  name="pricePerHour"
                  type="number"
                  min="1"
                  max="100000"
                  step="0.01"
                  value={hostForm.pricePerHour}
                  onChange={handleHostChange}
                  placeholder="e.g. 80"
                  required
                />
              </div>

              <button
                className="primary-btn"
                type="submit"
                disabled={hostLoading}
              >
                {hostLoading
                  ? 'Registering...'
                  : 'Register charger'}

                {!hostLoading && <span> →</span>}
              </button>

              {hostMessage && (
                <p
                  className="success-message"
                  role="status"
                >
                  ✓ {hostMessage}
                </p>
              )}

              {hostError && (
                <p
                  className="error-message"
                  role="alert"
                >
                  {hostError}
                </p>
              )}
            </form>
          </section>
        )}

        {/* BOTTOM BANNER */}

        <section className="bottom-banner">
          <div className="banner-bolt">ϟ</div>

          <div className="banner-copy">
            <h2>
              Every ride deserves a charging option.
            </h2>

            <p>
              Cars, bikes, and a community that shares power.
            </p>
          </div>

          <button
            className="banner-btn"
            type="button"
            onClick={() => scrollTo('find-chargers')}
          >
            Find your charger <span>↗</span>
          </button>
        </section>
      </main>

      {/* FOOTER */}

      <footer>
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon">ϟ</span>

          <span>
            Charge<span className="brand-accent">Share</span>
          </span>
        </a>

        <span className="footer-tagline">
          Share power. Move forward.
        </span>

        <span className="footer-note">
          A charging community for every ride.
        </span>
      </footer>
    </div>
  )
}

export default App